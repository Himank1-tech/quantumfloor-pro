"""
Neon Object Storage (S3-Compatible) Client for QuantumFloor Pro.
Provides persistent report storage, export file uploads, and presigned download URLs
for Backtest Lab runs, Trade Blotter CSVs, and F&O Strategy Payoff snapshots.
"""

import os
import io
import csv
import json
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List

logger = logging.getLogger("quantumfloor.storage")

class NeonStorage:
    def __init__(self):
        self.endpoint_url = os.environ.get("AWS_ENDPOINT_URL") or os.environ.get("AWS_ENDPOINT_URL_S3")
        self.access_key_id = os.environ.get("AWS_ACCESS_KEY_ID")
        self.secret_access_key = os.environ.get("AWS_SECRET_ACCESS_KEY")
        self.region = os.environ.get("AWS_REGION", "ap-southeast-1")
        self.bucket = os.environ.get("NEON_STORAGE_BUCKET", "quantumfloor-reports")
        self._client = None
        self._init_client()

    def _init_client(self):
        if self.endpoint_url and self.access_key_id and self.secret_access_key:
            try:
                import boto3
                self._client = boto3.client(
                    "s3",
                    endpoint_url=self.endpoint_url,
                    aws_access_key_id=self.access_key_id,
                    aws_secret_access_key=self.secret_access_key,
                    region_name=self.region,
                )
                logger.info(f"Neon Storage client initialized for bucket '{self.bucket}'")
            except Exception as e:
                logger.warning(f"Failed to initialize boto3 S3 client for Neon Storage: {e}")
                self._client = None
        else:
            logger.info("Neon Storage running in simulation/mock mode (missing S3 credentials)")

    def is_configured(self) -> bool:
        return self._client is not None

    def upload_data(self, key: str, data: bytes | str, content_type: str = "text/plain") -> str:
        """Uploads raw byte/string content to the configured Neon bucket and returns a presigned URL."""
        if isinstance(data, str):
            body = data.encode("utf-8")
        else:
            body = data

        if self._client:
            try:
                self._client.put_object(
                    Bucket=self.bucket,
                    Key=key,
                    Body=body,
                    ContentType=content_type
                )
                return self.get_presigned_url(key)
            except Exception as e:
                logger.error(f"Neon Storage upload error for key '{key}': {e}")
                raise
        else:
            # Fallback mock download URL for local offline testing
            return f"https://storage.quantumfloor.internal/{self.bucket}/{key}"

    def get_presigned_url(self, key: str, expires_in: int = 86400) -> str:
        """Generates a secure presigned download URL valid for 24 hours (or expires_in seconds)."""
        if self._client:
            try:
                return self._client.generate_presigned_url(
                    "get_object",
                    Params={"Bucket": self.bucket, "Key": key},
                    ExpiresIn=expires_in
                )
            except Exception as e:
                logger.error(f"Presigned URL generation failed for key '{key}': {e}")
                return f"{self.endpoint_url}/{self.bucket}/{key}"
        return f"https://storage.quantumfloor.internal/{self.bucket}/{key}"

    def export_trade_blotter(self, trades: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Generates CSV trade blotter and uploads it to Neon Object Storage."""
        output = io.StringIO()
        fieldnames = ["id", "symbol", "side", "qty", "price", "status", "execution_time", "pnl", "order_type"]
        writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for t in trades:
            writer.writerow(t)

        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        key = f"blotters/trade_blotter_{timestamp}.csv"
        url = self.upload_data(key, output.getvalue(), content_type="text/csv")
        return {
            "key": key,
            "filename": f"trade_blotter_{timestamp}.csv",
            "url": url,
            "count": len(trades),
            "created_at": datetime.now(timezone.utc).isoformat()
        }

    def export_backtest_report(self, backtest_data: Dict[str, Any]) -> Dict[str, Any]:
        """Uploads comprehensive Backtest Lab simulation results as structured JSON/CSV."""
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        strategy_id = backtest_data.get("strategy_id", "strategy").replace(" ", "_")
        key = f"backtests/{strategy_id}_{timestamp}.json"
        body = json.dumps(backtest_data, indent=2)
        url = self.upload_data(key, body, content_type="application/json")
        return {
            "key": key,
            "filename": f"{strategy_id}_{timestamp}.json",
            "url": url,
            "strategy": strategy_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        }

    def export_payoff_snapshot(self, snapshot_data: Dict[str, Any]) -> Dict[str, Any]:
        """Uploads F&O Strategy Payoff Matrix snapshot to Neon Object Storage."""
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        underlying = snapshot_data.get("underlying", "NIFTY")
        key = f"payoffs/{underlying}_payoff_{timestamp}.json"
        body = json.dumps(snapshot_data, indent=2)
        url = self.upload_data(key, body, content_type="application/json")
        return {
            "key": key,
            "filename": f"{underlying}_payoff_{timestamp}.json",
            "url": url,
            "underlying": underlying,
            "created_at": datetime.now(timezone.utc).isoformat()
        }

    def list_reports(self, prefix: str = "") -> List[Dict[str, Any]]:
        """Lists available report artifacts in the bucket."""
        if not self._client:
            return []
        try:
            resp = self._client.list_objects_v2(Bucket=self.bucket, Prefix=prefix)
            items = []
            for obj in resp.get("Contents", []):
                items.append({
                    "key": obj["Key"],
                    "size": obj["Size"],
                    "last_modified": obj["LastModified"].isoformat(),
                    "url": self.get_presigned_url(obj["Key"], expires_in=7200)
                })
            return items
        except Exception as e:
            logger.error(f"Failed to list objects in bucket '{self.bucket}': {e}")
            return []

# Singleton instance
storage_client = NeonStorage()
