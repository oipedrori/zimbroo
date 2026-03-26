import React, { useState, useEffect } from 'react';
import { X, Sparkles, MessageCircle, Brain, Target, History, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const PaywallModal = ({ isOpen, onClose, reason = 'feature' }) => {
    const { currentUser } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    
    const [shouldRender, setShouldRender] = useState(isOpen);
    const [isAnimating, setIsAnimating] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setShouldRender(true);
            setTimeout(() => setIsAnimating(true), 10);
        } else {
            setIsAnimating(false);
            const timeout = setTimeout(() => {
                setShouldRender(false);
            }, 300);
            return () => clearTimeout(timeout);
        }
    }, [isOpen]);

    if (!shouldRender && !isOpen) return null;

    const handleSubscribe = async (priceId) => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/create-checkout-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    priceId: priceId,
                    userId: currentUser?.uid,
                    customerEmail: currentUser?.email
                })
            });

            const session = await response.json();
            if (session.error) throw new Error(session.error);

            // Redireciona para o checkout do Stripe
            window.location.href = session.url;
        } catch (error) {
            console.error('Erro ao redirecionar para assinatura:', error);
            alert('Erro ao tentar assinar. Tente novamente.');
            setIsLoading(false);
        }
    };

    // Replace with actual Stripe Price IDs from Dashboard
    const MONTHLY_PRICE_ID = "price_1TE8tVFkzo4G14oz2i7OP9Gc";
    const YEARLY_PRICE_ID = "price_1TE8wYFkzo4G14ozqlx7lyyW";

    const isQuota = reason === 'quota';

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'var(--bg-color)', zIndex: 9999,
            display: 'flex', flexDirection: 'column',
            transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            transform: isAnimating ? 'translateY(0)' : 'translateY(100vh)',
            opacity: isAnimating ? 1 : 0
        }}>
            
            {/* Header Decorativo */}
            <div style={{
                background: 'var(--surface-color)', padding: '40px 24px 24px',
                textAlign: 'center', borderBottom: '1px solid var(--glass-border)'
            }}>
                <button onClick={onClose} style={{
                    position: 'absolute', top: '24px', right: '24px',
                    background: 'var(--bg-color)', border: '1px solid var(--glass-border)',
                    width: '36px', height: '36px', borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--text-main)', cursor: 'pointer'
                }}>
                    <X size={20} />
                </button>
                <div style={{
                    width: '64px', height: '64px', borderRadius: '20px',
                    background: 'rgba(75, 180, 90, 0.1)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
                    backdropFilter: 'blur(5px)'
                }}>
                    <Brain size={32} color="var(--primary-color)" />
                </div>
                
                <h2 style={{ color: 'var(--text-main)', fontSize: '1.4rem', fontWeight: '800', margin: '0 0 8px', letterSpacing: '-0.5px' }}>
                    {isQuota ? 'Você atingiu seu limite de 5 adições mágicas hoje! 🛑' : 'Desbloqueie o cérebro do Zimbroo 🧠'}
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0, lineHeight: 1.5 }}>
                    {isQuota 
                        ? 'Cansado de digitar? Assine o PRO para ter adições manuais e por voz ilimitadas, além de inteligência financeira completa. Comece com 7 dias grátis!' 
                        : 'Assuma o controle total do seu dinheiro com a ajuda da nossa Inteligência Artificial. Comece com 7 dias grátis!'}
                </p>
            </div>

            {/* Corpo do Modal */}
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    O que você ganha no PRO:
                </h3>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                        {[
                            { icon: <Sparkles size={20} />, text: 'Adição Mágica por Texto: Escreva como fala.' },
                            { icon: <MessageCircle size={20} />, text: 'Seu Conselheiro Financeiro: Dúvidas no chat.' },
                            { icon: <Brain size={20} />, text: 'IA Inteligente: Aprende seus hábitos.' },
                            { icon: <Target size={20} />, text: 'Limites Inteligentes: Sugestões automáticas.' },
                            { icon: <History size={20} />, text: 'Histórico Ilimitado: Acesse anos anteriores.' }
                        ].map((item, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'rgba(75, 180, 90, 0.1)', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    {item.icon}
                                </div>
                                <span style={{ fontSize: '0.95rem', color: 'var(--text-main)', fontWeight: '500' }}>
                                    {item.text}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Preços */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <button
                            onClick={() => handleSubscribe(MONTHLY_PRICE_ID)}
                            disabled={isLoading}
                            style={{
                                width: '100%', padding: '16px', borderRadius: '20px',
                                background: 'transparent', border: '2px solid var(--primary-color)',
                                color: 'var(--primary-color)', fontWeight: '700', fontSize: '1rem',
                                cursor: 'pointer', transition: 'all 0.2s',
                                opacity: isLoading ? 0.7 : 1
                            }}
                        >
                            Mensal - R$ 19,90 / mês
                            <div style={{ fontSize: '0.75rem', fontWeight: '500', opacity: 0.8, marginTop: '4px' }}>Após 7 dias grátis</div>
                        </button>

                        <button
                            onClick={() => handleSubscribe(YEARLY_PRICE_ID)}
                            disabled={isLoading}
                            style={{
                                width: '100%', padding: '16px', borderRadius: '20px',
                                background: 'var(--primary-gradient)', border: 'none',
                                color: 'white', fontWeight: '800', fontSize: '1rem',
                                cursor: 'pointer', transition: 'all 0.2s', position: 'relative',
                                boxShadow: '0 10px 25px rgba(75, 180, 90, 0.3)',
                                opacity: isLoading ? 0.7 : 1
                            }}
                        >
                            Anual - R$ 199,90 / ano
                            <div style={{ fontSize: '0.75rem', fontWeight: '600', opacity: 0.9, marginTop: '4px' }}>2 meses grátis!</div>
                        </button>
                    </div>
                </div>
        </div>
    );
};

export default PaywallModal;
