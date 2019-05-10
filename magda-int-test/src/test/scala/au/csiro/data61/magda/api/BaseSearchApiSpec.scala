package au.csiro.data61.magda.api

import java.io
import java.net.URL

import org.scalacheck.Arbitrary._
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.function.Consumer

import akka.http.scaladsl.model.headers.RawHeader

import scala.concurrent.Future
import scala.concurrent.duration.DurationInt
import org.scalacheck.Gen
import org.scalacheck.Shrink
import com.sksamuel.elastic4s.http.ElasticDsl._
import com.sksamuel.elastic4s.http.ElasticDsl
import akka.http.scaladsl.server.Route
import akka.stream.scaladsl.Source
import au.csiro.data61.magda.api.model.Protocols
import au.csiro.data61.magda.model.misc.DataSet
import au.csiro.data61.magda.indexer.search.elasticsearch.ElasticSearchIndexer
import au.csiro.data61.magda.search.elasticsearch.ElasticSearchQueryer
import au.csiro.data61.magda.search.elasticsearch.Indices
import au.csiro.data61.magda.test.api.BaseApiSpec
import au.csiro.data61.magda.test.util.ApiGenerators.textQueryGen
import au.csiro.data61.magda.test.util.Generators

import scala.collection.mutable
import au.csiro.data61.magda.model.Registry.{MAGDA_ADMIN_PORTAL_ID, MAGDA_TENANT_ID_HEADER, RegistryConverters}
import cats.instances.future

trait BaseSearchApiSpec extends BaseApiSpec with RegistryConverters with Protocols   {
  val INSERTION_WAIT_TIME = 500 seconds

  val cleanUpQueue = new ConcurrentLinkedQueue[String]()

  implicit def indexShrinker(implicit s: Shrink[String], s1: Shrink[List[DataSet]], s2: Shrink[Route]): Shrink[(String, List[DataSet], Route)] = Shrink[(String, List[DataSet], Route)] {
    case (indexName, dataSets, route) ⇒
      Shrink.shrink(dataSets).map(shrunkDataSets ⇒ {
        // Have this on warn level so it keeps travis entertained in long shrinks.
        logger.error("Shrunk datasets to size {} from {}", shrunkDataSets.size, dataSets.size)

        val result = putDataSetsInIndex(shrunkDataSets)
        cleanUpQueue.add(result._1)
        result
      })
  }

  def queryToText(query: Query): String = {
    textQueryGen(Gen.const(query)).retryUntil(_ => true).sample.get._1
  }

  implicit def textQueryShrinker(implicit s: Shrink[String], s1: Shrink[Query]): Shrink[(String, Query)] = Shrink[(String, Query)] {
    case (queryString, queryObj) ⇒
      Shrink.shrink(queryObj).map { shrunkQuery ⇒
        (queryToText(shrunkQuery), shrunkQuery)
      }
  }

  def emptyIndexGen: Gen[(String, List[DataSet], Route)] =
    Gen.delay {
      genIndexForSize(0)
    }

  def indexGen: Gen[(String, List[DataSet], Route)] =
    Gen.delay {
      Gen.choose(50, 70).flatMap { size =>
        genIndexForSize(size)
      }
    }
  def smallIndexGen: Gen[(String, List[DataSet], Route)] =
    Gen.delay {
      Gen.choose(0, 10).flatMap { size =>
        genIndexForSize(size)
      }
    }
  def mediumIndexGen: Gen[(String, List[DataSet], Route)] = indexGen

  def tenantsIndexGen(tenantIds: List[BigInt]): Gen[(String, List[DataSet], Route)]  =
    Gen.delay {
      Gen.choose(0, 10).flatMap { size =>
        genIndexForSize(size, tenantIds)
      }
    }

  def addTenantIdHeader(tenantId: BigInt): RawHeader = {
    RawHeader(MAGDA_TENANT_ID_HEADER, tenantId.toString)
  }

  def addSingleTenantIdHeader: RawHeader = {
    addTenantIdHeader(MAGDA_ADMIN_PORTAL_ID)
  }

  def genIndexForSize(rawSize: Int, tenantIds: List[BigInt] = List(MAGDA_ADMIN_PORTAL_ID)): (String, List[DataSet], Route) = {
    val size = rawSize % 100

    getFromIndexCache(size) match {
      case (_, None) ⇒
        val inputCache: mutable.Map[String, List[_]] = mutable.HashMap.empty

        if (tenantIds.nonEmpty){
          val dataSets: List[DataSet] = tenantIds.flatMap( tenantId =>
            Gen.listOfN(size, Generators.dataSetGen(inputCache, tenantId.toString)).retryUntil(_ => true).sample.get
          )
          putDataSetsInIndex(dataSets)
        }
        else {
          val dataSets = Gen.listOfN(size, Generators.dataSetGen(inputCache)).retryUntil(_ => true).sample.get
          putDataSetsInIndex(dataSets)
        }

      case (cacheKey, Some(cachedValue)) ⇒
        logger.debug("Cache hit for {}", cacheKey)
        val value: (String, List[DataSet], Route) = cachedValue.await(INSERTION_WAIT_TIME)
        value
    }
  }

  def getFromIndexCache(size: Int): (Int, Option[Future[(String, List[DataSet], Route)]]) = {
    //    val cacheKey = if (size < 20) size
    //    else if (size < 50) size - size % 3
    //    else if (size < 100) size - size % 4
    //    else size - size % 25
    val cacheKey = size
    logger.debug(cacheKey.toString)
    (cacheKey, Option(BaseSearchApiSpec.genCache.get(cacheKey)))
  }

  def putDataSetsInIndex(dataSets: List[DataSet]) = {

    blockUntilNotRed()

    val rawIndexName = java.util.UUID.randomUUID.toString
    val fakeIndices = FakeIndices(rawIndexName)

    val indexNames = List(
      fakeIndices.getIndex(config, Indices.DataSetsIndex),
      fakeIndices.getIndex(config, Indices.PublishersIndex),
      fakeIndices.getIndex(config, Indices.FormatsIndex)
    )

    val searchQueryer = new ElasticSearchQueryer(fakeIndices)
    val api = new SearchApi(searchQueryer)(config, logger)
    val indexer = new ElasticSearchIndexer(MockClientProvider, fakeIndices)

    val convertedDataSets = dataSets.map( d=>
      d.copy( publisher = d.publisher.map(p =>
            p.copy( acronym = getAcronymFromPublisherName(p.name))
        )
      )
    )

    val stream = Source.fromIterator[DataSet](() => convertedDataSets.iterator)

    indexer.ready.await(INSERTION_WAIT_TIME)

    indexNames.foreach{ idxName =>
      blockUntilIndexExists(idxName)
    }

    indexer.index(stream).await(INSERTION_WAIT_TIME)

    indexNames.foreach{ idxName =>
      refresh(idxName)
    }

    blockUntilExactCount(dataSets.size, indexNames(0))


    (indexNames(0), dataSets, api.routes)
  }

  def encodeForUrl(query: String) = java.net.URLEncoder.encode(query, "UTF-8")
  def cleanUpIndexes() = {
    blockUntilNotRed()
    cleanUpQueue.iterator().forEachRemaining(
      new Consumer[String] {
        override def accept(indexName: String) = {
          logger.debug(s"Deleting index $indexName")
          client.execute(ElasticDsl.deleteIndex(indexName)).await(INSERTION_WAIT_TIME)
          cleanUpQueue.remove()
        }
      })
  }

  override def afterEach() {
    super.afterEach()

    cleanUpIndexes()
  }
}

object BaseSearchApiSpec {
  val genCache: ConcurrentHashMap[Int, Future[(String, List[DataSet], Route)]] = new ConcurrentHashMap()
}
