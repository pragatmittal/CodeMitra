#!/bin/bash

echo "🚀 Deploying CodeMitra Rate Limiting and Scaling Fixes..."

# Set namespace
NAMESPACE="codemitra"
MONITORING_NAMESPACE="monitoring"
INGRESS_NAMESPACE="ingress-nginx"

# Create namespaces if they don't exist
echo "📁 Creating namespaces..."
kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace $MONITORING_NAMESPACE --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace $INGRESS_NAMESPACE --dry-run=client -o yaml | kubectl apply -f -

# Apply Pod Disruption Budgets for high availability
echo "🛡️  Applying Pod Disruption Budgets..."
kubectl apply -f k8s/pdb.yaml

# Apply Nginx Ingress Controller
echo "🌐 Deploying Nginx Ingress Controller..."
kubectl apply -f k8s/nginx-ingress.yaml

# Wait for ingress controller to be ready
echo "⏳ Waiting for Nginx Ingress Controller to be ready..."
kubectl wait --namespace $INGRESS_NAMESPACE \
  --for=condition=ready pod \
  --selector=app=nginx-ingress-controller \
  --timeout=300s

# Apply monitoring stack
echo "📊 Deploying monitoring stack..."
kubectl apply -f k8s/monitoring.yaml

# Wait for monitoring to be ready
echo "⏳ Waiting for monitoring stack to be ready..."
kubectl wait --namespace $MONITORING_NAMESPACE \
  --for=condition=ready pod \
  --selector=app=prometheus \
  --timeout=300s

kubectl wait --namespace $MONITORING_NAMESPACE \
  --for=condition=ready pod \
  --selector=app=grafana \
  --timeout=300s

# Apply updated backend configuration
echo "🔧 Applying updated backend configuration..."
kubectl apply -f k8s/backend.yaml

# Wait for backend to be ready
echo "⏳ Waiting for backend to be ready..."
kubectl wait --namespace $NAMESPACE \
  --for=condition=ready pod \
  --selector=app=backend \
  --timeout=300s

# Scale up backend pods for better performance
echo "📈 Scaling backend deployment..."
kubectl scale deployment backend --namespace $NAMESPACE --replicas=5

# Apply HPA configuration
echo "🔄 Applying Horizontal Pod Autoscaler..."
kubectl apply -f k8s/backend.yaml

# Check deployment status
echo "📋 Checking deployment status..."
kubectl get pods --namespace $NAMESPACE
kubectl get pods --namespace $MONITORING_NAMESPACE
kubectl get pods --namespace $INGRESS_NAMESPACE

# Check HPA status
echo "📊 Checking HPA status..."
kubectl get hpa --namespace $NAMESPACE

# Check ingress status
echo "🌐 Checking ingress status..."
kubectl get ingress --namespace $NAMESPACE

echo "✅ Deployment complete! Rate limiting and scaling fixes applied."
echo ""
echo "🔍 Next steps:"
echo "1. Test login functionality - should work without 429 errors"
echo "2. Monitor backend performance with: kubectl top pods --namespace $NAMESPACE"
echo "3. Check HPA scaling: kubectl describe hpa backend-hpa --namespace $NAMESPACE"
echo "4. Access monitoring: kubectl port-forward --namespace $MONITORING_NAMESPACE svc/grafana 3000:3000"
echo "5. Access Prometheus: kubectl port-forward --namespace $MONITORING_NAMESPACE svc/prometheus 9090:9090"
echo ""
echo "🚨 If you still see 429 errors, check:"
echo "   - Nginx logs: kubectl logs --namespace $INGRESS_NAMESPACE -l app=nginx-ingress-controller"
echo "   - Backend logs: kubectl logs --namespace $NAMESPACE -l app=backend"
echo "   - Rate limiting configuration in nginx.conf"
