import React, { useState, useEffect } from 'react';
import { ArrowRight, User, Users, Split, ChevronLeft, Sparkles, CheckCircle2 } from 'lucide-react';
import { useI18n } from '../contexts/I18nContext';
import { prototypeStorage, FINANCIAL_CONTEXTS, PROTOTYPE_STORAGE_KEYS } from '../services/prototypeStorage';

const PrototypeEntry = ({ onStart }) => {
    const { changeLocale } = useI18n();
    const [step, setStep] = useState('welcome'); // 'welcome' | 'choose_model' | 'family_setup'
    const [selectedModel, setSelectedModel] = useState('both'); // 'individual' | 'family' | 'both'
    
    // Configurações do espaço familiar
    const [spaceName, setSpaceName] = useState('Família Silva');
    const [creatorName, setCreatorName] = useState('José');
    const [partnerName, setPartnerName] = useState('Mariana');
    const [partnerEmail, setPartnerEmail] = useState('mariana@exemplo.com');
    const [includeInvite, setIncludeInvite] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        changeLocale('pt');
    }, [changeLocale]);

    const handleContinueFromModel = () => {
        setErrorMsg('');
        if (selectedModel === 'individual') {
            // Conclui imediatamente sem criar espaço familiar
            finishOnboarding('individual', null);
        } else {
            // Familiar ou Ambos -> avançar para setup do espaço familiar
            setStep('family_setup');
        }
    };

    const handleFinishFamilySetup = () => {
        setErrorMsg('');
        if (!spaceName.trim() || spaceName.trim().length < 2) {
            setErrorMsg('Informe um nome válido para o espaço familiar (mínimo 2 caracteres).');
            return;
        }
        if (!creatorName.trim() || creatorName.trim().length < 2) {
            setErrorMsg('Informe o nome do responsável (mínimo 2 caracteres).');
            return;
        }
        if (includeInvite) {
            if (partnerName.trim() && (!partnerEmail.trim() || !partnerEmail.includes('@'))) {
                setErrorMsg('Informe um e-mail válido para a identificação do convite demonstrativo.');
                return;
            }
        }

        setIsSubmitting(true);
        try {
            // Criação idempotente do espaço familiar
            const existingSpaces = prototypeStorage.getFamilySpaces();
            let space = existingSpaces.find(s => s.name.toLowerCase() === spaceName.trim().toLowerCase());
            
            if (!space) {
                space = prototypeStorage.createFamilySpace({
                    name: spaceName.trim(),
                    createdBy: 'prototipo',
                    creatorName: creatorName.trim()
                });
            } else {
                prototypeStorage.setActiveFamilyId(space.id);
            }

            // Convite simulado opcional
            if (includeInvite && partnerName.trim() && partnerEmail.trim()) {
                prototypeStorage.createFamilyInvite({
                    familyId: space.id,
                    inviteeName: partnerName.trim(),
                    inviteeEmail: partnerEmail.trim()
                });
            }

            finishOnboarding(selectedModel, space.id);
        } catch (err) {
            setErrorMsg(err.message || 'Erro ao configurar o espaço familiar.');
            setIsSubmitting(false);
        }
    };

    const finishOnboarding = (model, familyId) => {
        // Permite exibir o tour demonstrativo ao entrar na tela inicial
        try {
            localStorage.removeItem(PROTOTYPE_STORAGE_KEYS.HAS_COMPLETED_TOUR);
        } catch (e) {
            // ignore
        }

        // Persiste escolha de modelo
        prototypeStorage.setOnboardingModel(model);

        // Define contexto inicial de acordo com os requisitos da Etapa 5.2
        if (model === 'family' && familyId) {
            prototypeStorage.setActiveFamilyId(familyId);
            prototypeStorage.setActiveFinancialContext(FINANCIAL_CONTEXTS.FAMILY);
        } else {
            // Individual e Ambos iniciam no contexto Individual
            prototypeStorage.setActiveFinancialContext(FINANCIAL_CONTEXTS.INDIVIDUAL);
            if (familyId) {
                prototypeStorage.setActiveFamilyId(familyId);
            }
        }

        // Ativa o protótipo e notifica
        onStart();
    };

    return (
        <div style={{
            position: 'relative',
            width: '100%',
            maxWidth: '480px',
            margin: '0 auto',
            minHeight: '100dvh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '32px 24px',
            boxSizing: 'border-box',
            overflowY: 'auto',
            color: 'var(--btn-text)',
            boxShadow: 'var(--shadow-lg)'
        }}>
            {/* Background com o gradiente da marca */}
            <div className="onboarding-bg" style={{
                position: 'fixed',
                top: 0, left: 0, right: 0, bottom: 0,
                background: 'linear-gradient(135deg, var(--primary-darker) 0%, var(--primary-darkest) 100%)',
                zIndex: 0
            }} />

            {/* Top Navigation */}
            <div style={{ position: 'relative', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: '40px' }}>
                {step !== 'welcome' ? (
                    <button
                        onClick={() => {
                            setErrorMsg('');
                            if (step === 'family_setup') setStep('choose_model');
                            else if (step === 'choose_model') setStep('welcome');
                        }}
                        style={{
                            background: 'rgba(255, 255, 255, 0.15)',
                            border: '1px solid rgba(255, 255, 255, 0.25)',
                            borderRadius: '12px',
                            color: 'white',
                            padding: '8px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '0.85rem',
                            fontWeight: '600',
                            cursor: 'pointer'
                        }}
                    >
                        <ChevronLeft size={16} />
                        <span>Voltar</span>
                    </button>
                ) : <div />}

                <div style={{
                    padding: '4px 12px',
                    borderRadius: '16px',
                    background: 'rgba(255, 255, 255, 0.15)',
                    border: '1px solid rgba(255, 255, 255, 0.25)',
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    letterSpacing: '1px',
                    textTransform: 'uppercase'
                }}>
                    PROTÓTIPO
                </div>
            </div>

            {/* Conteúdo dinâmico por Step */}
            <div style={{ position: 'relative', zIndex: 10, margin: '24px 0', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                {step === 'welcome' && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                        <div style={{
                            width: '96px',
                            height: '96px',
                            borderRadius: '30px',
                            background: 'rgba(255, 255, 255, 0.12)',
                            backdropFilter: 'blur(20px)',
                            WebkitBackdropFilter: 'blur(20px)',
                            border: '1px solid rgba(255, 255, 255, 0.25)',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            marginBottom: '28px',
                            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)'
                        }}>
                            <img src="/Z.png" alt="Zimbroo" style={{ width: '60px', height: '60px', objectFit: 'contain' }} />
                        </div>

                        <h1 style={{
                            fontSize: '2.5rem',
                            fontWeight: '800',
                            letterSpacing: '-0.5px',
                            margin: '0 0 12px',
                            color: 'var(--btn-text)'
                        }}>
                            Zimbroo
                        </h1>
                        <p style={{
                            fontSize: '1rem',
                            color: 'rgba(255, 255, 255, 0.85)',
                            lineHeight: 1.5,
                            maxWidth: '340px',
                            margin: 0
                        }}>
                            Organização Financeira para você e a sua família.
                        </p>
                    </div>
                )}

                {step === 'choose_model' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ marginBottom: '8px' }}>
                            <h2 style={{ fontSize: '1.6rem', fontWeight: '800', margin: '0 0 6px', color: 'white' }}>
                                Como você quer se organizar?
                            </h2>
                            <p style={{ fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.8)', margin: 0, lineHeight: 1.4 }}>
                                Escolha o modelo para demonstrar no protótipo acadêmico.
                            </p>
                        </div>

                        {/* Model 1: Individual */}
                        <div
                            onClick={() => setSelectedModel('individual')}
                            style={{
                                padding: '16px',
                                borderRadius: '18px',
                                background: selectedModel === 'individual' ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.1)',
                                border: selectedModel === 'individual' ? '2px solid white' : '1px solid rgba(255, 255, 255, 0.2)',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                display: 'flex',
                                gap: '14px',
                                alignItems: 'flex-start'
                            }}
                        >
                            <div style={{
                                width: '40px', height: '40px', borderRadius: '12px',
                                background: 'rgba(255, 255, 255, 0.2)', display: 'flex',
                                alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0
                            }}>
                                <User size={22} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                    <span style={{ fontWeight: '700', fontSize: '1rem', color: 'white' }}>Individual</span>
                                    {selectedModel === 'individual' && <CheckCircle2 size={18} color="white" />}
                                </div>
                                <p style={{ fontSize: '0.82rem', color: 'rgba(255, 255, 255, 0.8)', margin: 0, lineHeight: 1.4 }}>
                                    Espaço financeiro pessoal, sem necessidade de configurar espaço familiar.
                                </p>
                            </div>
                        </div>

                        {/* Model 2: Familiar */}
                        <div
                            onClick={() => setSelectedModel('family')}
                            style={{
                                padding: '16px',
                                borderRadius: '18px',
                                background: selectedModel === 'family' ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.1)',
                                border: selectedModel === 'family' ? '2px solid white' : '1px solid rgba(255, 255, 255, 0.2)',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                display: 'flex',
                                gap: '14px',
                                alignItems: 'flex-start'
                            }}
                        >
                            <div style={{
                                width: '40px', height: '40px', borderRadius: '12px',
                                background: 'rgba(255, 255, 255, 0.2)', display: 'flex',
                                alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0
                            }}>
                                <Users size={22} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                    <span style={{ fontWeight: '700', fontSize: '1rem', color: 'white' }}>Familiar</span>
                                    {selectedModel === 'family' && <CheckCircle2 size={18} color="white" />}
                                </div>
                                <p style={{ fontSize: '0.82rem', color: 'rgba(255, 255, 255, 0.8)', margin: 0, lineHeight: 1.4 }}>
                                    Configura um espaço compartilhado e inicia a demonstração diretamente no contexto familiar.
                                </p>
                            </div>
                        </div>

                        {/* Model 3: Ambos */}
                        <div
                            onClick={() => setSelectedModel('both')}
                            style={{
                                padding: '16px',
                                borderRadius: '18px',
                                background: selectedModel === 'both' ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.1)',
                                border: selectedModel === 'both' ? '2px solid white' : '1px solid rgba(255, 255, 255, 0.2)',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                display: 'flex',
                                gap: '14px',
                                alignItems: 'flex-start'
                            }}
                        >
                            <div style={{
                                width: '40px', height: '40px', borderRadius: '12px',
                                background: 'rgba(255, 255, 255, 0.2)', display: 'flex',
                                alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0
                            }}>
                                <Split size={22} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                    <span style={{ fontWeight: '700', fontSize: '1rem', color: 'white' }}>Ambos</span>
                                    {selectedModel === 'both' && <CheckCircle2 size={18} color="white" />}
                                </div>
                                <p style={{ fontSize: '0.82rem', color: 'rgba(255, 255, 255, 0.8)', margin: 0, lineHeight: 1.4 }}>
                                    Permite utilizar o espaço individual e o familiar, com alternância livre entre eles.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {step === 'family_setup' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', margin: '0 0 6px', color: 'white' }}>
                                Espaço Familiar
                            </h2>
                            <p style={{ fontSize: '0.88rem', color: 'rgba(255, 255, 255, 0.8)', margin: 0, lineHeight: 1.4 }}>
                                Configure o espaço compartilhado e simule um convite de demonstração.
                            </p>
                        </div>

                        {errorMsg && (
                            <div style={{
                                background: 'rgba(239, 68, 68, 0.25)',
                                border: '1px solid rgba(239, 68, 68, 0.5)',
                                color: '#fee2e2',
                                padding: '10px 14px',
                                borderRadius: '12px',
                                fontSize: '0.85rem'
                            }}>
                                {errorMsg}
                            </div>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '6px', opacity: 0.9 }}>
                                    NOME DO ESPAÇO FAMILIAR
                                </label>
                                <input
                                    type="text"
                                    value={spaceName}
                                    onChange={(e) => setSpaceName(e.target.value)}
                                    placeholder="Ex: Família Silva"
                                    style={{
                                        width: '100%',
                                        padding: '14px 16px',
                                        background: 'rgba(255, 255, 255, 0.15)',
                                        border: '1px solid rgba(255, 255, 255, 0.3)',
                                        borderRadius: '14px',
                                        color: 'white',
                                        fontSize: '0.95rem',
                                        outline: 'none',
                                        boxSizing: 'border-box'
                                    }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '6px', opacity: 0.9 }}>
                                    SEU NOME (RESPONSÁVEL PRINCIPAL)
                                </label>
                                <input
                                    type="text"
                                    value={creatorName}
                                    onChange={(e) => setCreatorName(e.target.value)}
                                    placeholder="Ex: José"
                                    style={{
                                        width: '100%',
                                        padding: '14px 16px',
                                        background: 'rgba(255, 255, 255, 0.15)',
                                        border: '1px solid rgba(255, 255, 255, 0.3)',
                                        borderRadius: '14px',
                                        color: 'white',
                                        fontSize: '0.95rem',
                                        outline: 'none',
                                        boxSizing: 'border-box'
                                    }}
                                />
                            </div>

                            {/* Seção de Convite Simulado */}
                            <div style={{
                                marginTop: '8px',
                                padding: '16px',
                                borderRadius: '16px',
                                background: 'rgba(255, 255, 255, 0.1)',
                                border: '1px solid rgba(255, 255, 255, 0.2)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Sparkles size={16} color="white" />
                                        <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'white' }}>
                                            Convite Demonstrativo
                                        </span>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={includeInvite}
                                        onChange={(e) => setIncludeInvite(e.target.checked)}
                                        style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                                    />
                                </div>

                                {includeInvite && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                                        <input
                                            type="text"
                                            value={partnerName}
                                            onChange={(e) => setPartnerName(e.target.value)}
                                            placeholder="Nome do parceiro(a) (ex: Mariana)"
                                            style={{
                                                width: '100%',
                                                padding: '12px 14px',
                                                background: 'rgba(255, 255, 255, 0.15)',
                                                border: '1px solid rgba(255, 255, 255, 0.3)',
                                                borderRadius: '12px',
                                                color: 'white',
                                                fontSize: '0.9rem',
                                                outline: 'none',
                                                boxSizing: 'border-box'
                                            }}
                                        />
                                        <input
                                            type="email"
                                            value={partnerEmail}
                                            onChange={(e) => setPartnerEmail(e.target.value)}
                                            placeholder="E-mail do convite (ex: mariana@exemplo.com)"
                                            style={{
                                                width: '100%',
                                                padding: '12px 14px',
                                                background: 'rgba(255, 255, 255, 0.15)',
                                                border: '1px solid rgba(255, 255, 255, 0.3)',
                                                borderRadius: '12px',
                                                color: 'white',
                                                fontSize: '0.9rem',
                                                outline: 'none',
                                                boxSizing: 'border-box'
                                            }}
                                        />
                                        <p style={{ margin: '4px 0 0', fontSize: '0.75rem', opacity: 0.8, lineHeight: 1.3 }}>
                                            ✨ O convite e o aceite são simulados localmente para avaliação sem envio de e-mails reais.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Ação Inferior */}
            <div style={{
                position: 'relative',
                zIndex: 10,
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                marginTop: 'auto'
            }}>
                {step === 'welcome' && (
                    <button
                        onClick={() => setStep('choose_model')}
                        style={{
                            width: '100%',
                            padding: '18px',
                            backgroundColor: 'var(--surface-color)',
                            color: 'var(--text-main)',
                            borderRadius: 'var(--border-radius-lg)',
                            fontSize: '1.1rem',
                            fontWeight: '700',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: '12px',
                            boxShadow: '0 8px 25px rgba(0,0,0,0.2)',
                            transition: 'all 0.2s',
                            cursor: 'pointer',
                            border: 'none'
                        }}
                    >
                        <span>Começar agora</span>
                        <ArrowRight size={20} />
                    </button>
                )}

                {step === 'choose_model' && (
                    <button
                        onClick={handleContinueFromModel}
                        style={{
                            width: '100%',
                            padding: '18px',
                            backgroundColor: 'var(--surface-color)',
                            color: 'var(--text-main)',
                            borderRadius: 'var(--border-radius-lg)',
                            fontSize: '1.05rem',
                            fontWeight: '700',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: '12px',
                            boxShadow: '0 8px 25px rgba(0,0,0,0.2)',
                            transition: 'all 0.2s',
                            cursor: 'pointer',
                            border: 'none'
                        }}
                    >
                        <span>Continuar</span>
                        <ArrowRight size={20} />
                    </button>
                )}

                {step === 'family_setup' && (
                    <button
                        onClick={handleFinishFamilySetup}
                        disabled={isSubmitting}
                        style={{
                            width: '100%',
                            padding: '18px',
                            backgroundColor: 'var(--surface-color)',
                            color: 'var(--text-main)',
                            borderRadius: 'var(--border-radius-lg)',
                            fontSize: '1.05rem',
                            fontWeight: '700',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: '12px',
                            boxShadow: '0 8px 25px rgba(0,0,0,0.2)',
                            transition: 'all 0.2s',
                            cursor: isSubmitting ? 'not-allowed' : 'pointer',
                            opacity: isSubmitting ? 0.7 : 1,
                            border: 'none'
                        }}
                    >
                        <span>{isSubmitting ? 'Configurando...' : 'Concluir e Iniciar Protótipo'}</span>
                        <ArrowRight size={20} />
                    </button>
                )}
            </div>
        </div>
    );
};

export default PrototypeEntry;
