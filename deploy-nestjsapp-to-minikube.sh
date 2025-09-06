#!/bin/bash

# Update NestJS Pod with Latest Image
# This script builds a new image and updates the Kubernetes deployment

set -e  # Exit on any error

# Configuration
IMAGE_NAME="nest-profiling-test-nestjs-app"
NAMESPACE="monitoring"
DEPLOYMENT_NAME="nestjs-app"
PROJECT_DIR="/home/kt/projects/js-playground/nest-profiling-test"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
check_command() {
    if ! command -v $1 &> /dev/null; then
        print_error "$1 is not installed or not in PATH"
        exit 1
    fi
}

# Function to check if minikube is running
check_minikube() {
    if ! minikube status &> /dev/null; then
        print_error "Minikube is not running. Please start minikube first."
        exit 1
    fi
}

# Function to check if namespace exists
check_namespace() {
    if ! kubectl get namespace $NAMESPACE &> /dev/null; then
        print_error "Namespace '$NAMESPACE' does not exist"
        exit 1
    fi
}

# Function to check if deployment exists
check_deployment() {
    if ! kubectl get deployment $DEPLOYMENT_NAME -n $NAMESPACE &> /dev/null; then
        print_error "Deployment '$DEPLOYMENT_NAME' does not exist in namespace '$NAMESPACE'"
        exit 1
    fi
}

# Main update function
update_nestjs_pod() {
    print_status "Starting NestJS pod update process..."
    
    # Step 1: Check prerequisites
    print_status "Checking prerequisites..."
    check_command "kubectl"
    check_command "docker"
    check_command "minikube"
    check_minikube
    check_namespace
    check_deployment
    
    # Step 2: Navigate to project directory
    print_status "Navigating to project directory..."
    if [ -d "$PROJECT_DIR" ]; then
        cd "$PROJECT_DIR"
        print_success "Changed to project directory: $PROJECT_DIR"
    else
        print_error "Project directory does not exist: $PROJECT_DIR"
        exit 1
    fi
    
    # Step 3: Switch to minikube Docker context
    print_status "Switching to minikube Docker context..."
    eval $(minikube docker-env)
    print_success "Using minikube Docker daemon"
    
    # Step 4: Build new image with timestamp tag
    TIMESTAMP=$(date +%s)
    NEW_TAG="${IMAGE_NAME}:${TIMESTAMP}"
    
    print_status "Building new Docker image: $NEW_TAG"
    if docker build -t $NEW_TAG -t "${IMAGE_NAME}:latest" .; then
        print_success "Docker image built successfully"
    else
        print_error "Failed to build Docker image"
        exit 1
    fi
    
    # Step 5: Verify image exists
    print_status "Verifying image exists in minikube..."
    if docker images | grep -q "$IMAGE_NAME"; then
        print_success "Image verified in minikube registry"
    else
        print_error "Image not found in minikube registry"
        exit 1
    fi
        
    print_success "NestJS pod loaded"
    echo
    print_status "Summary:"
    echo "  • New image: $NEW_TAG"
    echo "  • Deployment: $DEPLOYMENT_NAME"
    echo "  • Namespace: $NAMESPACE"
    echo "  • Access URL: http://monitoring.local"
}

# Function to show help
show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo
    echo "Update NestJS pod with latest image in minikube cluster"
    echo
    echo "Options:"
    echo "  -h, --help     Show this help message"
    echo "  -v, --verbose  Enable verbose output"
    echo "  -f, --force    Force update even if there are warnings"
    echo
    echo "Examples:"
    echo "  $0                    # Standard update"
    echo "  $0 --verbose          # Update with verbose output"
    echo "  $0 --force            # Force update"
}

# Function for verbose mode
verbose_mode() {
    set -x  # Enable command echoing
}

# Function for force mode (skip some checks)
force_mode() {
    print_warning "Force mode enabled - skipping some safety checks"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -v|--verbose)
            verbose_mode
            shift
            ;;
        -f|--force)
            force_mode
            shift
            ;;
        *)
            print_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Run the main function
update_nestjs_pod