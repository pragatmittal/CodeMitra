# CodeMitra Automated Test Suite

A comprehensive automated testing framework for the CodeMitra collaborative coding platform. This test suite validates real-time collaboration features, code synchronization, user management, chat system, video calls, and code execution across multiple programming languages.

## 🚀 Features

- **Multi-User Testing**: Simulates 2-6 concurrent users interacting with the platform
- **Language Support**: Tests Java, Python, C++, and JavaScript rooms
- **Real-Time Validation**: Verifies Socket.IO events, code synchronization, and user presence
- **Performance Metrics**: Measures response times, delays, and resource usage
- **Comprehensive Reporting**: Generates detailed reports with error analysis and recommendations
- **Screenshot Capture**: Documents UI state during critical test moments
- **Automated Setup**: Handles user registration, room creation, and cleanup

## 📋 Prerequisites

Before running the test suite, ensure you have:

1. **CodeMitra Platform Running**:
   - Backend service on `localhost:5001`
   - Frontend service on `localhost:3000`
   - PostgreSQL, Redis, and Worker services running

2. **Node.js Environment**:
   - Node.js 18.0.0 or higher
   - npm 8.0.0 or higher

3. **System Requirements**:
   - At least 4GB RAM available
   - Stable internet connection for user registration
   - Headless browser support (for CI/CD environments)

## 🛠️ Installation

1. **Clone or navigate to the test suite directory**:
   ```bash
   cd /path/to/codemitra-test-suite
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Verify installation**:
   ```bash
   npm test -- help
   ```

## 🧪 Available Test Suites

### 1. Comprehensive Test Suite
```bash
npm test -- comprehensive
```
- **Scope**: Full platform testing with 6 users
- **Features**: Java room, all collaboration features
- **Duration**: 2-3 minutes
- **Use Case**: Complete platform validation

### 2. Multi-Language Test Suite
```bash
npm test -- multi-language
```
- **Scope**: All 4 supported languages (Java, Python, C++, JavaScript)
- **Features**: Language-specific code testing and execution
- **Duration**: 3-4 minutes
- **Use Case**: Language compatibility validation

### 3. Quick Test Suite
```bash
npm test -- quick
```
- **Scope**: Basic functionality with 2 users
- **Features**: Core collaboration features
- **Duration**: 1-2 minutes
- **Use Case**: Quick validation and debugging

### 4. Help and Configuration
```bash
npm test -- help
```
- **Scope**: Display available options and configuration
- **Features**: Prerequisites check and usage examples

## 📊 Test Scenarios Covered

### User Management
- ✅ User registration and authentication
- ✅ Room creation and joining
- ✅ Real-time user presence updates
- ✅ User disconnect and logout handling
- ✅ Ghost user detection and cleanup

### Code Collaboration
- ✅ Real-time code synchronization
- ✅ Multi-user concurrent editing
- ✅ Large file handling (100+ lines)
- ✅ Special characters and Unicode support
- ✅ Code formatting preservation

### Code Execution
- ✅ Language-specific compilation
- ✅ Code execution and output sharing
- ✅ Execution queue management
- ✅ Error handling and timeout management
- ✅ Real-time execution status updates

### Chat System
- ✅ Multi-user message delivery
- ✅ Message ordering and timestamps
- ✅ Chat history persistence
- ✅ Emoji and special character support
- ✅ Real-time chat synchronization

### Video Calls
- ✅ WebRTC peer connections
- ✅ ICE candidate exchange
- ✅ Media stream establishment
- ✅ Audio/video quality monitoring
- ✅ Connection stability testing

## 🔍 Test Execution Process

### 1. Prerequisites Check
The test suite automatically verifies:
- Test dependencies availability
- Backend service connectivity
- Frontend service accessibility
- Required ports availability

### 2. Test Execution
Each test suite follows this pattern:
1. **Setup Phase**: Create test users and establish connections
2. **Execution Phase**: Run collaborative scenarios
3. **Validation Phase**: Verify real-time synchronization
4. **Cleanup Phase**: Remove test data and close connections

### 3. Real-Time Monitoring
During execution, the suite monitors:
- Socket.IO event propagation
- Performance metrics and thresholds
- Error occurrences and categorization
- User interaction patterns

## 📈 Performance Metrics

The test suite measures and validates:

| Metric | Threshold | Description |
|--------|-----------|-------------|
| Code Sync Delay | <100ms | Time for code changes to propagate |
| User Join Delay | <500ms | Time for user presence updates |
| Chat Delivery | <200ms | Time for message delivery |
| Video Connection | <3000ms | Time for WebRTC establishment |
| Code Execution | <5000ms | Time for code compilation/execution |

## 📊 Test Results and Reporting

### Console Output
Real-time progress with detailed logging:
```
🚀 Starting: Comprehensive Test Suite
📝 Description: Full platform testing with 6 users, Java room, and all features
⏱️  Estimated Time: 2-3 minutes

🔍 Checking Prerequisites...
  ✅ Test Dependencies: OK
  ✅ Backend Service: OK
  ✅ Frontend Service: OK

✅ All prerequisites met. Starting tests...
==========================================

✅ User Registration Test: PASS
✅ Room Creation Test: PASS
✅ Code Synchronization Test: PASS
...
```

### Detailed Reports
Comprehensive JSON reports including:
- Test execution summary
- Performance analysis
- Error categorization
- Screenshot documentation
- Actionable recommendations

### Screenshots
Automatically captured during critical moments:
- User interface states
- Error conditions
- Performance bottlenecks
- Collaboration scenarios

## 🚨 Error Handling and Debugging

### Common Issues and Solutions

#### 1. Prerequisites Check Failed
```bash
❌ Backend Service: FAILED
   Fix: Start backend service: docker-compose -f docker-compose.dev.yml up backend
```
**Solution**: Ensure all CodeMitra services are running

#### 2. Test Dependencies Missing
```bash
❌ Test Dependencies: FAILED
   Fix: Run: npm install
```
**Solution**: Install required packages

#### 3. Connection Timeouts
```bash
❌ Frontend Service: FAILED
   Fix: Start frontend service: docker-compose -f docker-compose.dev.yml up frontend
```
**Solution**: Check service status and network connectivity

### Debug Mode
Enable detailed logging by setting environment variables:
```bash
DEBUG=true npm test -- comprehensive
```

## 🔧 Configuration

### Test Configuration File
Modify `test-config.js` to customize:
- Performance thresholds
- Test data and scenarios
- Language-specific test cases
- Error categorization

### Environment Variables
```bash
# Test environment
TEST_BASE_URL=http://localhost:3000
TEST_BACKEND_URL=http://localhost:5001
TEST_TIMEOUT=30000

# Debug mode
DEBUG=true
VERBOSE=true

# Screenshot settings
SCREENSHOT_DIR=./test-screenshots
RESULTS_DIR=./test-results
```

## 📁 File Structure

```
codemitra-test-suite/
├── run-tests.js              # Main test runner
├── test-config.js            # Test configuration
├── test-reporter.js          # Results reporting
├── automated-test-suite.js   # Core test framework
├── multi-language-test-suite.js # Language-specific tests
├── package.json              # Dependencies and scripts
├── README.md                 # This documentation
├── test-screenshots/         # Captured screenshots
└── test-results/            # Generated reports
```

## 🚀 Continuous Integration

### GitHub Actions Example
```yaml
name: CodeMitra Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm test -- comprehensive
```

### Docker Integration
```bash
# Run tests in Docker container
docker run --rm -v $(pwd):/app -w /app node:18 npm test -- comprehensive
```

## 🤝 Contributing

### Adding New Tests
1. **Test Structure**: Follow existing patterns in test files
2. **Configuration**: Add new test cases to `test-config.js`
3. **Reporting**: Integrate with `TestReporter` class
4. **Documentation**: Update this README with new features

### Test Development Guidelines
- **Isolation**: Each test should be independent
- **Cleanup**: Always clean up test data
- **Error Handling**: Graceful failure with detailed logging
- **Performance**: Monitor and report timing metrics

## 📞 Support and Troubleshooting

### Getting Help
1. **Check Prerequisites**: Run `npm test -- help`
2. **Review Logs**: Check console output for error details
3. **Verify Services**: Ensure CodeMitra platform is running
4. **Check Dependencies**: Verify npm packages are installed

### Common Debugging Steps
1. **Service Status**: Check Docker containers and service logs
2. **Network Connectivity**: Verify localhost ports are accessible
3. **Dependencies**: Ensure all npm packages are properly installed
4. **Permissions**: Check file system permissions for screenshots and reports

### Performance Optimization
- **Resource Monitoring**: Monitor CPU and memory usage during tests
- **Concurrent Users**: Adjust user count based on system capabilities
- **Timeout Settings**: Modify timeouts for slower environments
- **Screenshot Frequency**: Reduce screenshot capture for faster execution

## 📄 License

This test suite is part of the CodeMitra project and is licensed under the MIT License.

## 🔗 Related Links

- **CodeMitra Platform**: Main collaborative coding platform
- **Documentation**: Platform features and API reference
- **Issues**: Bug reports and feature requests
- **Contributing**: Development guidelines and setup

---

**Note**: This test suite is designed for the CodeMitra collaborative coding platform. Ensure compatibility with your platform version before running tests.
