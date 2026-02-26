# backend/app/schemas/__init__.py
"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  LumindAd Enterprise · backend/app/schemas/__init__.py
  Pydantic v2 schema package — re-exports by domain

  Design pattern
  ───────────────
  Each schema file follows the Request / Response split:

  schemas/campaign.py
    Request  → CampaignCreate, CampaignUpdate, StatusUpdateIn
    Response → CampaignOut, CampaignListOut, CampaignKPIsOut,
               CampaignPerformanceOut

  schemas/analytics.py
    Response → AnalyticsPointOut, AnalyticsKPIsOut,
               MLModelOut, PlatformShareOut, AnalyticsOut

  schemas/upload.py
    Request  → UploadInitIn, ChunkAckOut, FinalizeIn
    Response → UploadSessionOut, ProcessingJobOut,
               JobPollOut, UploadResultOut, MLPipelineExportOut

  ORM mode
  ─────────
  All response schemas declare:
      model_config = ConfigDict(from_attributes=True)
  This enables Schema.model_validate(orm_instance) without
  explicit .to_dict() calls.

  Usage
  ──────
  from app.schemas import CampaignOut, CampaignCreate
  from app.schemas import AnalyticsOut, MLModelOut
  from app.schemas import UploadSessionOut, JobPollOut

  Author : Elizabeth Díaz Familia
           AI Data Scientist · Sustainable Intelligence & BI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

# Campaign schemas
from app.schemas.campaign import (       # noqa: F401
    CampaignCreate,
    CampaignUpdate,
    StatusUpdateIn,
    CampaignOut,
    CampaignListOut,
    CampaignKPIsOut,
    CampaignPerformanceOut,
    CampaignMetricOut,
)

# Analytics schemas
from app.schemas.analytics import (     # noqa: F401
    AnalyticsPointOut,
    AnalyticsKPIsOut,
    AnalyticsKPICardOut,
    MLModelOut,
    PlatformShareOut,
    AnalyticsOut,
)

# Upload schemas
from app.schemas.upload import (        # noqa: F401
    UploadInitIn,
    UploadSessionOut,
    ChunkAckOut,
    FinalizeIn,
    ProcessingJobOut,
    JobPollOut,
    ColumnSchemaOut,
    UploadResultOut,
    MLPipelineExportOut,
)

__all__ = [
    # Campaign
    "CampaignCreate", "CampaignUpdate", "StatusUpdateIn",
    "CampaignOut", "CampaignListOut", "CampaignKPIsOut",
    "CampaignPerformanceOut", "CampaignMetricOut",
    # Analytics
    "AnalyticsPointOut", "AnalyticsKPIsOut", "AnalyticsKPICardOut",
    "MLModelOut", "PlatformShareOut", "AnalyticsOut",
    # Upload
    "UploadInitIn", "UploadSessionOut", "ChunkAckOut",
    "FinalizeIn", "ProcessingJobOut", "JobPollOut",
    "ColumnSchemaOut", "UploadResultOut", "MLPipelineExportOut",
]
