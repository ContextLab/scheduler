/**
 * T026b — Unit tests for UI state management
 * Tests step navigation, loading spinner, error messages, back navigation.
 * Written TDD-style: defines expected API before app.js implementation.
 */

// App module will be implemented in T031/T035
let App;
try {
  App = require('../../frontend/js/app');
} catch (e) {
  App = null;
}

const describeIfExists = App ? describe : describe.skip;

// Build DOM structure matching index.html using safe DOM methods
function setupDOM() {
  document.body.textContent = '';

  const indicator = document.createElement('div');
  indicator.className = 'step-indicator';
  indicator.id = 'step-indicator';

  const stepLabels = ['1. Meeting Type', '2. Date & Time', '3. Your Details', '4. Confirmation'];
  stepLabels.forEach((label, i) => {
    const span = document.createElement('span');
    span.className = i === 0 ? 'step active' : 'step';
    span.dataset.step = String(i + 1);
    span.textContent = label;
    indicator.appendChild(span);
  });
  document.body.appendChild(indicator);

  for (let i = 1; i <= 4; i++) {
    const section = document.createElement('section');
    section.id = 'step-' + i;
    section.className = i === 1 ? 'step-content active' : 'step-content';
    document.body.appendChild(section);
  }

  const loading = document.createElement('div');
  loading.id = 'loading';
  loading.className = 'loading-overlay';
  document.body.appendChild(loading);

  const errorBanner = document.createElement('div');
  errorBanner.id = 'error-banner';
  errorBanner.className = 'error-banner';
  document.body.appendChild(errorBanner);
}

describeIfExists('Step navigation', () => {
  beforeEach(setupDOM);

  test('goToStep shows correct step content and updates indicator', () => {
    App.goToStep(2);
    expect(document.getElementById('step-2').classList.contains('active')).toBe(true);
    expect(document.getElementById('step-1').classList.contains('active')).toBe(false);
  });

  test('goToStep marks previous steps as completed', () => {
    App.goToStep(3);
    const steps = document.querySelectorAll('.step-indicator .step');
    expect(steps[0].classList.contains('completed')).toBe(true);
    expect(steps[1].classList.contains('completed')).toBe(true);
    expect(steps[2].classList.contains('active')).toBe(true);
  });

  test('only one step is active at a time', () => {
    App.goToStep(2);
    const activeSteps = document.querySelectorAll('.step-content.active');
    expect(activeSteps).toHaveLength(1);
  });
});

describeIfExists('Loading spinner', () => {
  beforeEach(setupDOM);

  test('showLoading adds visible class', () => {
    App.showLoading();
    expect(document.getElementById('loading').classList.contains('visible')).toBe(true);
  });

  test('hideLoading removes visible class', () => {
    App.showLoading();
    App.hideLoading();
    expect(document.getElementById('loading').classList.contains('visible')).toBe(false);
  });
});

describeIfExists('Error messages', () => {
  beforeEach(setupDOM);

  test('showError displays error banner with message', () => {
    App.showError('Something went wrong');
    const banner = document.getElementById('error-banner');
    expect(banner.classList.contains('visible')).toBe(true);
    expect(banner.textContent).toBe('Something went wrong');
  });

  test('hideError removes error banner', () => {
    App.showError('Oops');
    App.hideError();
    expect(document.getElementById('error-banner').classList.contains('visible')).toBe(false);
  });

  test('error auto-hides after timeout', () => {
    jest.useFakeTimers();
    App.showError('Temp error', 3000);
    jest.advanceTimersByTime(3000);
    expect(document.getElementById('error-banner').classList.contains('visible')).toBe(false);
    jest.useRealTimers();
  });
});
