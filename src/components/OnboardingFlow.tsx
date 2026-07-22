/**
 * OnboardingFlow — First-run welcome and guided tutorial for CalenRecall.
 *
 * Shows a step-by-step walkthrough for new users covering:
 * 1. Welcome — what CalenRecall is
 * 2. Navigation — how to move through time
 * 3. Entries — how to create and manage journal entries
 * 4. Calendar systems — how to switch between 17 calendars
 * 5. Themes — how to customize the look
 * 6. Profiles — how to manage multiple profiles
 * 7. Done — ready to start
 *
 * Each step has a visual illustration, concise text, and a "Next" / "Skip" button.
 * After completion, a flag is stored in preferences so it only shows once.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { announce } from '../utils/accessibility';

// ── Types ──

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  /** Optional CSS class for special step styling */
  className?: string;
  /** Optional action buttons shown in the step */
  actions?: OnboardingAction[];
}

interface OnboardingAction {
  label: string;
  action: () => void;
  primary?: boolean;
}

interface OnboardingFlowProps {
  /** Called when onboarding is complete (or skipped) */
  onComplete: () => void;
  /** Whether the flow should appear */
  show: boolean;
  /** Optional steps override for customization */
  steps?: OnboardingStep[];
}

// ── Default Steps ──

const DEFAULT_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to CalenRecall',
    description:
      'A calendar journal for recalling memories across decades, years, months, weeks, and days. ' +
      'Write entries at any time scale, explore 17 calendar systems from cultures worldwide, ' +
      'and navigate your personal history with an interactive timeline.',
    className: 'onboarding-step-welcome',
  },
  {
    id: 'navigation',
    title: 'Navigating Time',
    description:
      'Use the arrow buttons or swipe to move between time periods. ' +
      'Click on a day to zoom in, or use the view mode selector (Day, Week, Month, Year, Decade) ' +
      'to change the visible time range. The minimap on the side gives you a bird\'s eye view of your entries.',
    className: 'onboarding-step-navigation',
  },
  {
    id: 'entries',
    title: 'Creating Journal Entries',
    description:
      'Click any date to select it, then use the editor panel to write your entry. ' +
      'You can set a title, write rich content, add tags, and specify an exact time. ' +
      'Entries can span any time range — from a single day to an entire decade.',
    className: 'onboarding-step-entries',
  },
  {
    id: 'calendars',
    title: 'Calendar Systems',
    description:
      'Switch between 17 calendar systems including Gregorian, Hebrew, Islamic, Chinese, ' +
      'Persian, Mayan, Ethiopian, Baháʼí, and more. All dates are converted accurately via ' +
      'the Julian Day Number system. Enable astronomical events and cultural holidays in Layers.',
    className: 'onboarding-step-calendars',
  },
  {
    id: 'themes',
    title: 'Customizing Themes',
    description:
      'Choose from 37 built-in themes to change the look and feel of the app. ' +
      'Open Preferences to explore themes, adjust font sizes, enable performance mode, ' +
      'or load custom themes from your computer.',
    className: 'onboarding-step-themes',
  },
  {
    id: 'profiles',
    title: 'Profiles & Privacy',
    description:
      'CalenRecall supports multiple isolated profiles, each with its own database. ' +
      'Profiles can be password-protected with recovery keys for maximum privacy. ' +
      'Use the Profile Selector at startup or switch from Preferences.',
    className: 'onboarding-step-profiles',
  },
  {
    id: 'done',
    title: 'Ready to Go!',
    description:
      'You\'re all set. Start writing your memories, exploring different calendar systems, ' +
      'and making the app your own. You can revisit this tour anytime from the About window.',
    className: 'onboarding-step-done',
  },
];

// ── Component ──

export function OnboardingFlow({
  onComplete,
  show,
  steps = DEFAULT_STEPS,
}: OnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [exiting, setExiting] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Focus heading when step changes
  useEffect(() => {
    if (show && headingRef.current) {
      headingRef.current.focus();
    }
    announce(
      `Onboarding step ${currentStep + 1} of ${steps.length}: ${steps[currentStep].title}`,
      false
    );
  }, [currentStep, show, steps]);

  // Trap focus within the overlay when showing
  useEffect(() => {
    if (!show || !overlayRef.current) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleSkip();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [show, currentStep]);

  const handleNext = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleComplete();
    }
  }, [currentStep, steps.length]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const handleSkip = useCallback(() => {
    setExiting(true);
    setTimeout(() => {
      onComplete();
    }, 300);
  }, [onComplete]);

  const handleComplete = useCallback(() => {
    setExiting(true);
    setTimeout(() => {
      announce('Onboarding complete. Welcome to CalenRecall!', true);
      onComplete();
    }, 300);
  }, [onComplete]);

  const step = steps[currentStep];

  if (!show) return null;

  return (
    <div
      ref={overlayRef}
      className={`onboarding-overlay ${exiting ? 'onboarding-exiting' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to CalenRecall"
    >
      {/* Progress bar */}
      <div className="onboarding-progress" role="progressbar" aria-valuenow={currentStep + 1} aria-valuemin={1} aria-valuemax={steps.length}>
        <div
          className="onboarding-progress-bar"
          style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
        />
      </div>

      {/* Step indicator */}
      <div className="onboarding-step-indicator" aria-hidden="true">
        {steps.map((s, i) => (
          <div
            key={s.id}
            className={`onboarding-dot ${i === currentStep ? 'onboarding-dot-active' : ''} ${i < currentStep ? 'onboarding-dot-completed' : ''}`}
          />
        ))}
      </div>

      {/* Content */}
      <div className={`onboarding-content ${step.className || ''}`}>
        {/* Step number */}
        <div className="onboarding-step-number" aria-hidden="true">
          {String(currentStep + 1).padStart(2, '0')}
        </div>

        {/* Title */}
        <h2
          ref={headingRef}
          className="onboarding-title"
          tabIndex={-1}
        >
          {step.title}
        </h2>

        {/* Description */}
        <p className="onboarding-description">{step.description}</p>

        {/* Custom actions */}
        {step.actions && step.actions.length > 0 && (
          <div className="onboarding-custom-actions">
            {step.actions.map((action, i) => (
              <button
                key={i}
                className={`onboarding-custom-btn ${action.primary ? 'onboarding-custom-btn-primary' : ''}`}
                onClick={action.action}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="onboarding-nav">
        <div className="onboarding-nav-left">
          {currentStep > 0 ? (
            <button
              className="onboarding-nav-btn"
              onClick={handlePrev}
              aria-label="Previous step"
            >
              ← Back
            </button>
          ) : (
            <button
              className="onboarding-nav-btn onboarding-skip-btn"
              onClick={handleSkip}
              aria-label="Skip onboarding"
            >
              Skip Tour
            </button>
          )}
        </div>

        <div className="onboarding-nav-right">
          {currentStep < steps.length - 1 ? (
            <button
              className="onboarding-nav-btn onboarding-nav-btn-primary"
              onClick={handleNext}
              aria-label="Next step"
            >
              Next →
            </button>
          ) : (
            <button
              className="onboarding-nav-btn onboarding-nav-btn-primary"
              onClick={handleComplete}
              aria-label="Get started"
            >
              Get Started!
            </button>
          )}
          <button
            className="onboarding-nav-btn onboarding-skip-btn"
            onClick={handleSkip}
            aria-label="Skip onboarding"
          >
            Skip
          </button>
        </div>
      </div>

      {/* Step count */}
      <div className="onboarding-step-count" aria-live="polite">
        Step {currentStep + 1} of {steps.length}
      </div>
    </div>
  );
}

export default OnboardingFlow;
