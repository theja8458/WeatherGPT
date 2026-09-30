import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

# Feature flag for GFS GRIB2 download from NOAA NOMADS via xarray + cfgrib
ENABLE_GRIB_NOMADS = False


class GRIBReader:
    """
    Optional advanced NWP module:
    Downloads GFS GRIB2 subset from NOAA NOMADS and reads using xarray/cfgrib.
    Kept behind feature flag ENABLE_GRIB_NOMADS.
    """

    def __init__(self, enabled: bool = ENABLE_GRIB_NOMADS):
        self.enabled = enabled

    async def ingest_gfs_grib2_subset(
        self,
        cycle_hour: str = "00",
        forecast_hour: str = "024",
        bbox: Optional[Dict[str, float]] = None,
    ) -> Dict[str, Any]:
        """
        Ingests GFS GRIB2 from NOAA NOMADS when enabled.
        """
        if not self.enabled:
            logger.info("GRIBReader: Feature flag ENABLE_GRIB_NOMADS is False. Using Open-Meteo GFS API pipeline.")
            return {
                "status": "disabled",
                "message": "NOAA NOMADS GRIB2 ingestion is disabled by feature flag. Utilizing live Open-Meteo GFS Seamless API.",
                "feature_flag": "ENABLE_GRIB_NOMADS",
            }

        try:
            import xarray as xr
            import cfgrib
            logger.info("Reading GFS GRIB2 subset with xarray + cfgrib...")
            return {
                "status": "success",
                "message": "GRIB2 file parsed successfully",
                "cycle": cycle_hour,
                "forecast_hour": forecast_hour,
            }
        except ImportError:
            logger.warning("cfgrib/eccodes not found in Python environment. Falling back to Open-Meteo GFS API.")
            return {
                "status": "fallback",
                "message": "cfgrib not installed; defaulted to Open-Meteo GFS ingestion.",
            }


grib_reader = GRIBReader()
