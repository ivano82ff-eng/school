import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import tourConfig from './tourConfig.cjs';

const { getTourSteps, isTourDone, markTourDone, resetTour } = tourConfig;

function measure(selector) {
  const el = document.querySelector(selector);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return {
    top: rect.top + window.scrollY,
    left: rect.left + window.scrollX,
    width: rect.width,
    height: rect.height,
    viewportTop: rect.top,
    viewportLeft: rect.left,
  };
}

export default function OnboardingTour({ user, forceKey = 0, onFinished }) {
  const steps = useMemo(() => getTourSteps(user?.role), [user?.role]);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [spot, setSpot] = useState(null);

  useEffect(() => {
    if (!user) {
      setOpen(false);
      return;
    }
    if (forceKey > 0) {
      resetTour(user.id);
      setIndex(0);
      setOpen(true);
      return;
    }
    if (!isTourDone(user.id)) {
      setIndex(0);
      setOpen(true);
    }
  }, [user, forceKey]);

  const step = steps[index];

  useLayoutEffect(() => {
    if (!open || !step) return undefined;

    function update() {
      const box = measure(step.selector);
      setSpot(box);
      if (box) {
        const el = document.querySelector(step.selector);
        el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }

    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, step, index]);

  if (!user || !open || !step) return null;

  function finish() {
    markTourDone(user.id);
    setOpen(false);
    onFinished?.();
  }

  function next() {
    if (index >= steps.length - 1) finish();
    else setIndex((i) => i + 1);
  }

  const pad = 8;
  const tipStyle = spot
    ? {
        top: Math.min(
          spot.viewportTop + spot.height + 14,
          window.innerHeight - 220
        ),
        left: Math.min(Math.max(16, spot.viewportLeft), window.innerWidth - 340),
      }
    : { top: '30%', left: '50%', transform: 'translateX(-50%)' };

  return (
    <div className="tour-root" role="dialog" aria-modal="true" aria-label="Обучающий гид">
      <div className="tour-backdrop" onClick={finish} />
      {spot && (
        <div
          className="tour-spotlight"
          style={{
            top: spot.viewportTop - pad,
            left: spot.viewportLeft - pad,
            width: spot.width + pad * 2,
            height: spot.height + pad * 2,
          }}
        />
      )}
      <div className="tour-card" style={tipStyle}>
        <div className="tour-progress">
          Шаг {index + 1} из {steps.length}
        </div>
        <h3>{step.title}</h3>
        <p>{step.body}</p>
        <div className="tour-actions">
          <button type="button" className="btn btn-ghost" onClick={finish}>
            Пропустить
          </button>
          <button type="button" className="btn btn-primary" onClick={next}>
            {index >= steps.length - 1 ? 'Готово' : 'Далее'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function useTourReplay() {
  const [forceKey, setForceKey] = useState(0);
  return {
    forceKey,
    replayTour: () => setForceKey((k) => k + 1),
  };
}
