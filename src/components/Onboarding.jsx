import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '../contexts/I18nContext';
import { haptic } from '../utils/haptic';

const ONBOARDING_STEPS = [
  {
    id: 'onboarding-balance-card',
    text: "Acompanhe de perto o seu dinheiro. Veja o que entrou, o que saiu e o que ainda está sobrando no mês."
  },
  {
    id: 'onboarding-limits-section',
    text: "Defina limites para cada categoria. Eles duram até o final do ano para te ajudar a manter o orçamento nos trilhos."
  },
  {
    id: 'onboarding-transactions-list',
    text: "Seu histórico completo de receitas e despesas fica aqui. Use os filtros para visualizar tudo separadamente."
  },
  {
    id: 'onboarding-ai-fab',
    text: "Seu assistente pessoal! Fale com a IA do Zimbroo para adicionar movimentações, tirar dúvidas financeiras ou obter conselhos. Você também pode adicionar tudo manualmente."
  },
  {
    id: 'onboarding-stats-btn',
    text: "Mergulhe nos seus dados. Acesse gráficos detalhados por categoria e veja um panorama geral do seu comportamento nos meses."
  },
  {
    id: 'onboarding-profile-btn',
    text: "Acesse as configurações da sua conta e personalize seu perfil aqui."
  }
];

const Onboarding = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState(null);
  const { t } = useI18n();
  const [isVisible, setIsVisible] = useState(false);

  // Check if already completed
  useEffect(() => {
    const completed = localStorage.getItem('hasCompletedOnboarding');
    if (completed === 'true') {
      onComplete?.();
    } else {
      setIsVisible(true);
    }
  }, [onComplete]);

  // Update rect on step change or resize
  useEffect(() => {
    if (!isVisible) return;

    const findTarget = () => {
      const step = ONBOARDING_STEPS[currentStep];
      const element = document.getElementById(step.id);
      if (element) {
        const rect = element.getBoundingClientRect();
        if (rect.height > 0) {
          setTargetRect({
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height,
            padding: step.id === 'onboarding-ai-fab' ? 20 : 8
          });
        } else {
          skipNext();
        }
      } else {
        skipNext();
      }
    };

    const skipNext = () => {
      if (currentStep < ONBOARDING_STEPS.length - 1) {
        setCurrentStep(prev => prev + 1);
      } else {
        localStorage.setItem('hasCompletedOnboarding', 'true');
        setIsVisible(false);
        onComplete?.();
      }
    };

    findTarget();
    window.addEventListener('resize', findTarget);
    window.addEventListener('scroll', findTarget, true);

    return () => {
      window.removeEventListener('resize', findTarget);
      window.removeEventListener('scroll', findTarget, true);
    };
  }, [currentStep, isVisible]);

  const handleNext = () => {
    haptic.light();
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      localStorage.setItem('hasCompletedOnboarding', 'true');
      setIsVisible(false);
      setTimeout(() => onComplete?.(), 500);
    }
  };

  if (!isVisible || !targetRect) return null;

  // Visual cohesion: display card near the spotlight
  // If there's space below, show it below. Otherwise show it above.
  const tooltipHeight = 160; // Approximate
  const padding = 20;
  const isTooLow = targetRect.y + targetRect.height + tooltipHeight + padding > window.innerHeight;
  
  const tooltipPosition = isTooLow 
    ? { top: Math.max(20, targetRect.y - tooltipHeight - padding) }
    : { top: targetRect.y + targetRect.height + padding };

  return (
    <motion.div 
      className="onboarding-overlay"
      onClick={handleNext}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 9999,
        cursor: 'pointer',
        pointerEvents: 'auto'
      }}
    >
      {/* SVG Mask for Spotlight */}
      <svg style={{ position: 'absolute', width: '100%', height: '100%', pointerEvents: 'none' }}>
        <defs>
          <filter id="blurFilter">
            <feGaussianBlur in="SourceGraphic" stdDeviation="8" />
          </filter>
          <mask id="spotlight-mask">
            <rect width="100%" height="100%" fill="white" />
            <motion.rect
              animate={{
                x: targetRect.x - targetRect.padding,
                y: targetRect.y - targetRect.padding,
                width: targetRect.width + targetRect.padding * 2,
                height: targetRect.height + targetRect.padding * 2,
                rx: 16
              }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              fill="black"
              filter="url(#blurFilter)"
            />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="black" opacity="0.8" mask="url(#spotlight-mask)" />
      </svg>

      {/* Tooltip Card */}
      <AnimatePresence mode="wait">
        <motion.div
           key={currentStep}
           initial={{ opacity: 0, scale: 0.95 }}
           animate={{ opacity: 1, scale: 1 }}
           exit={{ opacity: 0, scale: 0.95 }}
           transition={{ duration: 0.3 }}
           style={{
             position: 'absolute',
             width: '280px',
             background: 'var(--surface-color)',
             backdropFilter: 'blur(20px)',
             padding: '20px',
             borderRadius: '20px',
             border: '1px solid var(--glass-border)',
             boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
             color: 'var(--text-main)',
             zIndex: 10000,
             pointerEvents: 'none',
             left: '50%',
             transform: 'translateX(-50%)',
             marginLeft: '-140px', // Center it manually
             ...tooltipPosition
           }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--primary-color)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Passo {currentStep + 1} de {ONBOARDING_STEPS.length}
            </span>
            <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: '1.5', fontWeight: '500' }}>
              {ONBOARDING_STEPS[currentStep].text}
            </p>
            
            {currentStep === 0 && (
              <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.6, fontSize: '0.8rem' }}>
                <div className="pulse-dot" />
                Toque em qualquer lugar para continuar
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      <style>{`
        .pulse-dot {
          width: 8px;
          height: 8px;
          background: var(--primary-color);
          border-radius: 50%;
          animation: onboardingPulse 2s infinite;
        }
        @keyframes onboardingPulse {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(75, 180, 90, 0.7); }
          70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(75, 180, 90, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(75, 180, 90, 0); }
        }
      `}</style>
    </motion.div>
  );
};

export default Onboarding;
