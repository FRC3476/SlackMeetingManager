#!/bin/bash

# Google Cloud Deployment Script for Slack Meeting Attendance App
# Usage: ./deploy.sh [project-id] [bucket-name]

set -e

PROJECT_ID=${1:-$(gcloud config get-value project 2>/dev/null)}
BUCKET_NAME=${2}

if [ -z "$PROJECT_ID" ]; then
  echo "Error: Project ID required"
  echo "Usage: ./deploy.sh [project-id] [bucket-name]"
  echo "Or set default project: gcloud config set project YOUR_PROJECT_ID"
  exit 1
fi

echo "🚀 Deploying to Google Cloud Project: $PROJECT_ID"
echo ""

# Check if bucket name is provided
if [ -z "$BUCKET_NAME" ]; then
  echo "⚠️  No bucket name provided. Creating one..."
  BUCKET_NAME="slack-meeting-app-data-$(date +%s)"
  echo "Creating bucket: $BUCKET_NAME"
  gsutil mb -l us-central1 gs://$BUCKET_NAME 2>/dev/null || echo "Bucket may already exist"
  echo "✅ Bucket created: $BUCKET_NAME"
  echo ""
fi

# Update cloudbuild.yaml with bucket name
sed -i.bak "s/_GCS_BUCKET_NAME:.*/_GCS_BUCKET_NAME: '$BUCKET_NAME'/" cloudbuild.yaml

echo "📦 Building and deploying..."
gcloud builds submit --config cloudbuild.yaml --substitutions=_GCS_BUCKET_NAME=$BUCKET_NAME

# Restore original cloudbuild.yaml
mv cloudbuild.yaml.bak cloudbuild.yaml 2>/dev/null || true

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Get your service URL:"
echo "   gcloud run services describe slack-meeting-app --region=us-central1 --format='value(status.url)'"
echo ""
echo "2. Update Slack app settings with the service URL"
echo ""
echo "3. Set up Cloud Scheduler jobs (see DEPLOYMENT.md)"
echo ""
echo "4. Configure the app using /meeting-config in Slack"







