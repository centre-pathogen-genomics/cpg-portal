# Admin Stats API Documentation

The Stats API provides comprehensive system statistics for the admin panel. **All endpoints require superuser privileges.**

## Endpoints

### GET /api/v1/stats/stats

Returns comprehensive system statistics for admin panel monitoring.

**Authentication:** Required  
**Permissions:** Superuser only

**Response:**
```json
{
  "users": {
    "total": 150,
    "active": 142,
    "superusers": 3,
    "active_last_30_days": 89
  },
  "files": {
    "total": 50000,
    "saved": 35000,
    "temporary": 15000,
    "total_size_bytes": 107374182400,
    "saved_size_bytes": 85899345920,
    "temporary_size_bytes": 21474836480,
    "average_size_bytes": 2147483,
    "total_size_gb": 100.0,
    "saved_size_gb": 80.0,
    "by_type": {
      "fastq": 15000,
      "vcf": 8000,
      "bam": 5000,
      "txt": 4000,
      "csv": 3000
    }
  },
  "runs": {
    "total": 8500,
    "by_status": {
      "completed": 7650,
      "failed": 420,
      "running": 15,
      "pending": 385,
      "cancelled": 30
    },
    "currently_running": 15,
    "success_rate_percent": 94.8,
    "average_runtime_seconds": 3600,
    "average_runtime_minutes": 60.0,
    "last_24_hours": 125
  },
  "tools": {
    "total": 45,
    "enabled": 38,
    "disabled": 7,
    "by_status": {
      "installed": 38,
      "uninstalled": 5,
      "installing": 1,
      "failed": 1
    },
    "most_popular": {
      "FastQC": 2500,
      "BWA": 2200,
      "GATK": 1800,
      "Bowtie2": 1600,
      "SAMtools": 1400
    },
    "most_favourited": {
      "FastQC": 89,
      "BWA": 76,
      "GATK": 65,
      "Bowtie2": 58,
      "SAMtools": 52
    }
  }
}
```

### GET /api/v1/stats/summary

Returns a condensed summary of key system statistics for admin dashboard widgets.

**Authentication:** Required  
**Permissions:** Superuser only

**Response:**
```json
{
  "users": {
    "total": 150
  },
  "tools": {
    "total": 45,
    "enabled": 38
  },
  "runs": {
    "total": 8500,
    "currently_running": 15
  },
  "files": {
    "total": 50000,
    "total_size_gb": 100.0
  }
}
```

## Error Responses

### 401 Unauthorized
```json
{
  "detail": "Authentication required"
}
```

### 403 Forbidden
```json
{
  "detail": "Superuser access required"
}
```

## Statistics Breakdown

### User Statistics
- `total`: Total number of registered users
- `active`: Users with `is_active = true`
- `superusers`: Users with superuser privileges
- `active_last_30_days`: Users who created runs in the last 30 days

### File Statistics
- `total`: All files in the system
- `saved`: Files marked as saved (permanent)
- `temporary`: Files not marked as saved
- `total_size_bytes`: Total storage used by all files
- `saved_size_bytes`: Storage used by saved files
- `temporary_size_bytes`: Storage used by temporary files
- `average_size_bytes`: Average file size
- `total_size_gb`: Total storage in GB
- `saved_size_gb`: Saved storage in GB
- `by_type`: File count by type (top 10)

### Run Statistics
- `total`: Total number of runs/jobs
- `by_status`: Count of runs by status (pending, running, completed, failed, cancelled)
- `currently_running`: Active runs
- `success_rate_percent`: Percentage of completed vs failed runs
- `average_runtime_seconds`: Average execution time for completed runs
- `average_runtime_minutes`: Average execution time in minutes
- `last_24_hours`: Runs created in the last 24 hours

### Tool Statistics
- `total`: Total number of tools
- `enabled`: Tools available for use
- `disabled`: Tools not available for use
- `by_status`: Count by installation status
- `most_popular`: Top 10 tools by run count
- `most_favourited`: Top 10 tools by favourite count

## Use Cases

1. **Admin Dashboard**: Display key system metrics and health indicators
2. **System Monitoring**: Track overall system performance and usage
3. **Capacity Planning**: Monitor storage usage and user activity for infrastructure planning
4. **Performance Analytics**: Analyze run success rates and execution times
5. **Administrative Reports**: Generate usage reports for management and decision making

## Security

- **Authentication Required**: All endpoints require valid authentication
- **Superuser Only**: Both endpoints require superuser privileges (403 error for non-superusers)
- **Admin Panel Focused**: Designed specifically for administrative monitoring and management
