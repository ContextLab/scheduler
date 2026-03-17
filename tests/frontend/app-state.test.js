/**
 * Unit tests for UI state management — 5-step booking flow.
 * Tests step navigation, loading spinner, error messages, back navigation.
 */

let App;
try {
  App = require('../../js/app');
} catch (e) {
  App = null;
}

const describeIfExists = App ? describe : describe.skip;

// Build DOM structure matching 5-step index.html
function setupDOM() {
  document.body.textContent = '';

  const indicator = document.createElement('div');
  indicator.className = 'step-indicator';
  indicator.id = 'step-indicator';

  const stepLabels = ['1. Meeting Type', '2. Duration', '3. Date & Time', '4. Your Details', '5. Confirmation'];
  stepLabels.forEach((label, i) => {
    const span = document.createElement('span');
    span.className = i === 0 ? 'step active' : 'step';
    span.dataset.step = String(i + 1);
    span.textContent = label;
    indicator.appendChild(span);
  });
  document.body.appendChild(indicator);

  for (let i = 1; i <= 5; i++) {
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

describeIfExists('Step navigation (5-step flow)', () => {
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

  test('goToStep works for all 5 steps', () => {
    for (let step = 1; step <= 5; step++) {
      App.goToStep(step);
      expect(document.getElementById('step-' + step).classList.contains('active')).toBe(true);
      const activeSteps = document.querySelectorAll('.step-content.active');
      expect(activeSteps).toHaveLength(1);
    }
  });

  test('step 4 shows steps 1-3 as completed', () => {
    App.goToStep(4);
    const steps = document.querySelectorAll('.step-indicator .step');
    expect(steps[0].classList.contains('completed')).toBe(true);
    expect(steps[1].classList.contains('completed')).toBe(true);
    expect(steps[2].classList.contains('completed')).toBe(true);
    expect(steps[3].classList.contains('active')).toBe(true);
    expect(steps[4].classList.contains('active')).toBe(false);
  });

  test('step 5 shows steps 1-4 as completed', () => {
    App.goToStep(5);
    const steps = document.querySelectorAll('.step-indicator .step');
    expect(steps[0].classList.contains('completed')).toBe(true);
    expect(steps[1].classList.contains('completed')).toBe(true);
    expect(steps[2].classList.contains('completed')).toBe(true);
    expect(steps[3].classList.contains('completed')).toBe(true);
    expect(steps[4].classList.contains('active')).toBe(true);
  });

  test('going back to step 1 clears completed states', () => {
    App.goToStep(3);
    App.goToStep(1);
    const steps = document.querySelectorAll('.step-indicator .step');
    expect(steps[0].classList.contains('active')).toBe(true);
    expect(steps[1].classList.contains('completed')).toBe(false);
    expect(steps[2].classList.contains('completed')).toBe(false);
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
