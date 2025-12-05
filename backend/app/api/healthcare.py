"""
Healthcare Facility API Router
Handles healthcare facility search (hospitals, pharmacies, dialysis centers)
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import logging
from datetime import datetime

from app.db.mongodb_manager import OptimizedMongoDBManager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/healthcare", tags=["healthcare"])

# MongoDB manager instance
db_manager = OptimizedMongoDBManager()


# ==================== Request/Response Models ====================

class HealthcareFacilitySearchRequest(BaseModel):
    """Request for healthcare facility search"""
    region: Optional[str] = Field(default=None, description="Region filter (e.g., 서울, 부산, 경기)")
    has_dialysis: Optional[bool] = Field(default=None, description="Filter for facilities with dialysis units")
    night_dialysis: Optional[bool] = Field(default=None, description="Filter for night dialysis facilities")
    query: Optional[str] = Field(default=None, description="Text search query for name or address")
    limit: int = Field(default=20, ge=1, le=100, description="Maximum results")


class HealthcareFacilityResponse(BaseModel):
    """Response for a healthcare facility"""
    name: str
    address: str
    phone: Optional[str] = None
    region: Optional[str] = None
    type: Optional[str] = None
    has_dialysis_unit: bool = False
    night_dialysis: bool = False
    dialysis_machines: Optional[int] = None
    dialysis_days: Optional[str] = None
    naver_map_url: Optional[str] = None
    kakao_map_url: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None


# ==================== Startup/Shutdown ====================

async def connect_db():
    """Connect to MongoDB on startup"""
    await db_manager.connect()
    logger.info("Healthcare API: MongoDB connected")


async def close_db():
    """Close MongoDB connection on shutdown"""
    await db_manager.close()
    logger.info("Healthcare API: MongoDB closed")


# ==================== API Endpoints ====================

@router.post("/search")
async def search_healthcare_facilities(request: HealthcareFacilitySearchRequest) -> Dict[str, Any]:
    """
    Search healthcare facilities (hospitals, pharmacies, dialysis centers)

    Filters:
        - region: Filter by region (e.g., "서울", "부산")
        - has_dialysis: Filter for facilities with dialysis units
        - night_dialysis: Filter for night dialysis availability
        - query: Text search on facility name or address
    """
    try:
        logger.info(f"Healthcare facility search: region={request.region}, query={request.query}")

        # Ensure DB connection
        if not db_manager.client:
            await db_manager.connect()

        results = await db_manager.search_healthcare_facilities(
            region=request.region,
            has_dialysis=request.has_dialysis,
            night_dialysis=request.night_dialysis,
            query=request.query,
            limit=request.limit
        )

        return {
            "status": "success",
            "facilities": results,
            "count": len(results),
            "searchParams": {
                "region": request.region,
                "has_dialysis": request.has_dialysis,
                "night_dialysis": request.night_dialysis,
                "query": request.query
            }
        }

    except Exception as e:
        logger.error(f"Error searching healthcare facilities: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/search")
async def search_healthcare_facilities_get(
    region: Optional[str] = Query(default=None, description="Region filter (e.g., 서울, 부산, 경기)"),
    has_dialysis: Optional[bool] = Query(default=None, description="Filter for dialysis facilities"),
    night_dialysis: Optional[bool] = Query(default=None, description="Filter for night dialysis"),
    query: Optional[str] = Query(default=None, description="Text search query"),
    limit: int = Query(default=20, ge=1, le=100, description="Maximum results")
) -> Dict[str, Any]:
    """
    Search healthcare facilities (GET endpoint for easy testing)
    """
    request = HealthcareFacilitySearchRequest(
        region=region,
        has_dialysis=has_dialysis,
        night_dialysis=night_dialysis,
        query=query,
        limit=limit
    )
    return await search_healthcare_facilities(request)


@router.get("/dialysis")
async def get_dialysis_centers(
    region: Optional[str] = Query(default=None, description="Region filter"),
    night_only: bool = Query(default=False, description="Only show night dialysis centers"),
    limit: int = Query(default=20, ge=1, le=100, description="Maximum results")
) -> Dict[str, Any]:
    """
    Get dialysis centers, optionally filtered by region and night availability
    """
    try:
        logger.info(f"Dialysis centers request: region={region}, night_only={night_only}")

        # Ensure DB connection
        if not db_manager.client:
            await db_manager.connect()

        results = await db_manager.get_dialysis_centers(
            region=region,
            night_only=night_only,
            limit=limit
        )

        return {
            "status": "success",
            "dialysis_centers": results,
            "count": len(results),
            "searchParams": {
                "region": region,
                "night_only": night_only
            }
        }

    except Exception as e:
        logger.error(f"Error getting dialysis centers: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats")
async def get_healthcare_stats() -> Dict[str, Any]:
    """
    Get healthcare facility statistics
    """
    try:
        logger.info("Healthcare facility stats request")

        # Ensure DB connection
        if not db_manager.client:
            await db_manager.connect()

        stats = await db_manager.get_healthcare_facility_stats()

        return {
            "status": "success",
            "stats": stats,
            "generated_at": datetime.now().isoformat()
        }

    except Exception as e:
        logger.error(f"Error getting healthcare stats: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/regions")
async def get_available_regions() -> Dict[str, Any]:
    """
    Get list of available regions with facility counts
    """
    try:
        # Ensure DB connection
        if not db_manager.client:
            await db_manager.connect()

        stats = await db_manager.get_healthcare_facility_stats()
        regions = stats.get("by_region", [])

        return {
            "status": "success",
            "regions": regions
        }

    except Exception as e:
        logger.error(f"Error getting regions: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Health Check ====================

@router.get("/health")
async def health_check() -> Dict[str, Any]:
    """Health check endpoint for healthcare API"""
    try:
        # Ensure DB connection
        if not db_manager.client:
            await db_manager.connect()

        # Test database connectivity
        stats = await db_manager.get_healthcare_facility_stats()
        total = stats.get("total", 0)

        return {
            "status": "healthy",
            "service": "healthcare_api",
            "database": "connected",
            "total_facilities": total
        }
    except Exception as e:
        logger.error(f"Health check error: {e}")
        return {
            "status": "degraded",
            "service": "healthcare_api",
            "error": str(e)
        }
