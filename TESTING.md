# Testing Guide

This guide covers how to test the Helm Chart Diff Viewer application, including both manual testing and automated testing.

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Automated Testing](#automated-testing)
- [Manual Testing](#manual-testing)
- [Test Coverage](#test-coverage)
- [Writing New Tests](#writing-new-tests)

## Prerequisites

Before running tests, ensure you have:

1. **Node.js 18+** and **npm 9+** installed
2. **Dependencies installed**: Run `npm install`
3. **Helm 3.x** installed (for manual testing and integration tests)

## Automated Testing

### Running Tests

The project uses **Jest** and **React Testing Library** for automated testing.

#### Run all tests:
```bash
npm test
```

#### Run tests in watch mode (for development):
```bash
npm run test:watch
```

#### Run tests with coverage report:
```bash
npm run test:coverage
```

### Test Structure

Tests are organized as follows:

```
├── app/
│   └── api/
│       └── compare/
│           └── __tests__/
│               └── route.test.ts          # API route tests
├── components/
│   └── __tests__/
│       ├── CompareForm.test.tsx          # Form component tests
│       └── DiffDisplay.test.tsx          # Display component tests
└── services/
    └── __tests__/
        └── helm-service.test.ts          # Service unit tests
```

### Test Types

#### 1. Unit Tests (`services/__tests__/helm-service.test.ts`)

Tests for the `HelmService` class, including:
- Version comparison logic
- Error handling (missing chart paths, git failures)
- Values file handling
- Template rendering

**Example:**
```bash
npm test -- helm-service
```

#### 2. Component Tests

**CompareForm Tests** (`components/__tests__/CompareForm.test.tsx`):
- Form field rendering
- Form submission
- Loading states
- Optional field handling

**DiffDisplay Tests** (`components/__tests__/DiffDisplay.test.tsx`):
- Version information display
- Diff content rendering
- Empty diff handling

**Example:**
```bash
npm test -- CompareForm
npm test -- DiffDisplay
```

#### 3. API Route Tests (`app/api/compare/__tests__/route.test.ts`)

Tests for the `/api/compare` endpoint:
- Request validation
- Error handling
- Successful comparisons
- Parameter passing

**Example:**
```bash
npm test -- route.test
```

### Running Specific Tests

Run a specific test file:
```bash
npm test -- CompareForm.test.tsx
```

Run tests matching a pattern:
```bash
npm test -- --testNamePattern="should successfully compare"
```

Run tests for a specific directory:
```bash
npm test -- components
```

## Manual Testing

### 1. Start the Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

### 2. Test the UI

#### Basic Comparison Test

1. Open `http://localhost:3000` in your browser
2. Fill in the form:
   - **Repository URL**: `https://github.com/your-org/helm-charts.git`
   - **Chart Path**: `charts/myapp`
   - **Version 1**: `v1.0.0` (or a branch/commit)
   - **Version 2**: `v1.1.0` (or a branch/commit)
3. Click **Compare Versions**
4. Verify the diff is displayed correctly

#### Test with Values File

1. Fill in the form as above
2. Add a **Values File Path**: `values/prod.yaml`
3. Click **Compare Versions**
4. Verify the comparison uses the values file

#### Test with Values Content

1. Fill in the form as above
2. Paste YAML content in **Values Content**:
   ```yaml
   replicaCount: 3
   image:
     repository: nginx
     tag: latest
   ```
3. Click **Compare Versions**
4. Verify the comparison uses the provided values

#### Error Handling Tests

1. **Invalid Repository URL**: Enter an invalid URL and verify error message
2. **Missing Fields**: Submit form with empty required fields and verify validation
3. **Non-existent Chart Path**: Use a chart path that doesn't exist and verify error
4. **Invalid Version**: Use a version/tag that doesn't exist and verify error

### 3. Test the API Directly

You can test the API endpoint directly using `curl`:

```bash
curl -X POST http://localhost:3000/api/compare \
  -H "Content-Type: application/json" \
  -d '{
    "repository": "https://github.com/your-org/helm-charts.git",
    "chartPath": "charts/myapp",
    "version1": "v1.0.0",
    "version2": "v1.1.0",
    "valuesFile": "values/prod.yaml"
  }'
```

Or using a tool like [Postman](https://www.postman.com/) or [Insomnia](https://insomnia.rest/).

### 4. Integration Testing

For full integration testing, you'll need:

1. A test Helm chart repository (or use a public one)
2. Multiple versions/tags to compare
3. Values files for testing

**Example test repository setup:**
```bash
# Create a test repo
git clone https://github.com/your-org/test-helm-charts.git
cd test-helm-charts

# Create test versions
git tag v1.0.0
# Make changes
git commit -am "Update chart"
git tag v1.1.0
```

## Test Coverage

View coverage report:
```bash
npm run test:coverage
```

This generates a coverage report showing:
- **Statements**: Percentage of code statements executed
- **Branches**: Percentage of code branches executed
- **Functions**: Percentage of functions executed
- **Lines**: Percentage of lines executed

Coverage reports are generated in the `coverage/` directory. Open `coverage/lcov-report/index.html` in a browser for a detailed view.

### Coverage Goals

- **Statements**: > 80%
- **Branches**: > 75%
- **Functions**: > 80%
- **Lines**: > 80%

## Writing New Tests

### Test File Naming

- Test files should be named `*.test.ts` or `*.test.tsx`
- Place test files in `__tests__` directories next to the code they test
- Or use the `.test.ts` suffix in the same directory

### Example: Writing a Component Test

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MyComponent } from '../MyComponent';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('should handle user interaction', async () => {
    const user = userEvent.setup();
    render(<MyComponent />);
    
    await user.click(screen.getByRole('button'));
    expect(screen.getByText('Clicked!')).toBeInTheDocument();
  });
});
```

### Example: Writing a Service Test

```typescript
import { MyService } from '../my-service';

// Mock external dependencies
jest.mock('child_process');

describe('MyService', () => {
  it('should perform operation', async () => {
    const service = new MyService();
    const result = await service.doSomething();
    
    expect(result).toBeDefined();
  });
});
```

### Best Practices

1. **Isolate tests**: Each test should be independent
2. **Use descriptive names**: Test names should clearly describe what they test
3. **Arrange-Act-Assert**: Structure tests with clear sections
4. **Mock external dependencies**: Don't make real API calls or file system operations in unit tests
5. **Test edge cases**: Include tests for error conditions and boundary cases
6. **Keep tests simple**: One assertion per test when possible

### Testing Utilities

The project includes:

- **@testing-library/react**: For React component testing
- **@testing-library/user-event**: For simulating user interactions
- **@testing-library/jest-dom**: For additional DOM matchers
- **jest**: Test runner and assertion library

## Troubleshooting

### Tests fail with "Cannot find module"

Run `npm install` to ensure all dependencies are installed.

### Tests timeout

Increase timeout in test file:
```typescript
jest.setTimeout(10000); // 10 seconds
```

### Mock not working

Ensure mocks are set up in `beforeEach` or at the top of the test file:
```typescript
jest.mock('module-name');
```

### Coverage not generating

Check that `collectCoverageFrom` in `jest.config.js` includes your files.

## Continuous Integration

For CI/CD pipelines, add these steps:

```yaml
# Example GitHub Actions
- name: Install dependencies
  run: npm ci

- name: Run tests
  run: npm test

- name: Generate coverage
  run: npm run test:coverage
```

## Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Testing Library](https://testing-library.com/react)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

---

Happy Testing! 🧪

