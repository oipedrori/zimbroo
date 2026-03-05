import React, { useState, useEffect, useRef } from 'react';
import { Mic, Plus, Edit2, Send } from 'lucide-react';
import { analyzeTextWithGemini } from '../services/geminiService';
import { useTransactions } from '../hooks/useTransactions';
import { format } from 'date-fns';

const AiPanel = ({ isActive, onClose, onOpenManualModal, onListeningChange }) => {
    const [isListening, setIsListening] = useState(false);

    useEffect(() => {
        if (onListeningChange) {
            onListeningChange(isListening);
        }
    }, [isListening, onListeningChange]);

    const [transcript, setTranscript] = useState('');
    const [aiMessage, setAiMessage] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isManualTextMode, setIsManualTextMode] = useState(false);
    const [manualText, setManualText] = useState('');
    const [conversationContext, setConversationContext] = useState(null);
    const inputRef = useRef(null);
    const recognitionRef = useRef(null);
    const silenceTimeoutRef = useRef(null);
    const transcriptRef = useRef(''); // To keep latest state for timeout

    const { transactions, addTx, deleteTx } = useTransactions(format(new Date(), 'yyyy-MM'));

    // Setup Speech Recognition
    useEffect(() => {
        // Verificar suporte da API nativa do navegador
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'pt-BR';

            recognition.onstart = () => {
                setIsListening(true);
            };

            recognition.onresult = (event) => {
                let currentTranscript = '';
                for (let i = 0; i < event.results.length; ++i) {
                    currentTranscript += event.results[i][0].transcript;
                }
                setTranscript(currentTranscript);
                transcriptRef.current = currentTranscript;

                // Clear existing silence timeout
                if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);

                // Set new timeout to autosubmit after 2 seconds of silence
                silenceTimeoutRef.current = setTimeout(() => {
                    if (transcriptRef.current.trim().length > 0 && !isProcessing) {
                        processTextRef.current(transcriptRef.current);
                    }
                }, 1500);
            };

            recognition.onerror = (event) => {
                console.error('Speech recognition error', event.error);
                setIsListening(false);
                if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
            };

            recognition.onend = () => {
                setIsListening(false);
                // Try to process if ended and we have transcript
                if (transcriptRef.current.trim().length > 0 && !isProcessing) {
                    processTextRef.current(transcriptRef.current);
                }
            };

            recognitionRef.current = recognition;
        }
    }, []);

    // Monitora mudança na prop isActive do bottom-nav para ligar o microfone automaticamente
    useEffect(() => {
        if (isActive) {
            setTranscript('');
            transcriptRef.current = '';
            setAiMessage('');
            setIsManualTextMode(false);
            setManualText('');
            setConversationContext(null);

            // Try starting automatically
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.start();
                } catch (e) {
                    console.error("Auto-start failure", e);
                }
            }
            if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
        } else {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
            if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
            setIsListening(false);
        }
    }, [isActive]);

    const toggleListen = () => {
        if (isListening) {
            recognitionRef.current?.stop();
        } else {
            setTranscript('');
            recognitionRef.current?.start();
        }
    };

    const handleManualAdd = () => {
        onClose();
        onOpenManualModal();
    };

    const processTextRef = useRef(null);

    // We update the ref implementation so the timer always calls the latest logic
    useEffect(() => {
        processTextRef.current = async (textToProcess) => {
            if (!textToProcess.trim() || isProcessing) return;

            recognitionRef.current?.stop();
            setIsListening(false);
            setIsProcessing(true);
            if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);

            setAiMessage('Analisando...');

            try {
                const result = await analyzeTextWithGemini(textToProcess, transactions, conversationContext);

                if (result.error) {
                    setAiMessage(result.error);
                    setTranscript('');
                    transcriptRef.current = '';
                    setConversationContext(null);
                } else if (result.action === 'need_info') {
                    setAiMessage(result.message);
                    setConversationContext(result.pendingData);
                    // Do not clear the transcript so the user remembers what they just said.
                    setManualText('');
                    if (!isManualTextMode) {
                        // Restart mic to listen to the answer after reading
                        setTimeout(() => {
                            recognitionRef.current?.start();
                        }, 1000);
                    }
                } else if (result.action === 'delete') {
                    await deleteTx(result.targetId);
                    setAiMessage(result.message || "A transação foi removida.");
                    setTranscript('');
                    transcriptRef.current = '';
                    setTimeout(() => onClose(), 2500);
                } else if (result.action === 'analysis') {
                    setAiMessage(result.message);
                    setTranscript('');
                    transcriptRef.current = '';
                    // We don't auto-close the panel on analysis so the user has time to read it.
                } else if (result.action === 'add') {
                    const tx = result.transaction;
                    const finalDate = tx.date ? tx.date : format(new Date(), 'yyyy-MM-dd');

                    await addTx({
                        type: tx.type,
                        amount: parseFloat(tx.amount),
                        description: tx.description,
                        category: tx.category,
                        date: finalDate,
                        repeatType: tx.repeatType,
                        installments: tx.installments || 1
                    });

                    // Confirmação de Sucesso Polida e Curta
                    const tipoTexto = tx.type === 'income' ? 'Adicionado com sucesso' : 'Gasto registrado';
                    setAiMessage(`Tudo certo! ${tipoTexto}: ${tx.description} (R$ ${tx.amount}).`);

                    setTranscript('');
                    transcriptRef.current = '';
                    setConversationContext(null);

                    // Fecha sozinho depois de ler
                    setTimeout(() => onClose(), 2500);
                }
            } catch (err) {
                console.error(err);
                setAiMessage('Ocorreu um erro ao processar. Tente novamente.');
            } finally {
                setIsProcessing(false);
            }
        };
    }, [isProcessing, addTx, onClose]);

    const handleProcessManualClick = () => {
        if (transcriptRef.current.trim().length > 0 && !isProcessing) {
            processTextRef.current(transcriptRef.current);
        }
    };

    const handleSendText = () => {
        if (manualText.trim().length > 0 && !isProcessing) {
            processTextRef.current(manualText);
        }
    };

    const toggleTextMode = () => {
        setIsManualTextMode(true);
        if (transcriptRef.current) {
            setManualText(transcriptRef.current + ' ');
        }
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }
        setIsListening(false);
        setTimeout(() => {
            if (inputRef.current) inputRef.current.focus();
        }, 100);
    };

    return (
        <div className={`ai-overlay ${isActive ? 'active' : ''}`}>

            <div className="ai-minimal-content">
                {/* Texto de Status no Topo - Só renderiza conteúdo se isActive (evita flash de texto na saída) */}
                <div className="ai-status-text" style={{ opacity: isActive ? 1 : 0, transition: 'opacity 0.2s' }}>
                    {aiMessage && (
                        <p className="ai-system-message animate-fade-in" style={{ marginBottom: (!isProcessing && conversationContext) ? '20px' : '0' }}>
                            {aiMessage}
                        </p>
                    )}

                    {(!aiMessage || (conversationContext && !isProcessing)) ? (
                        isManualTextMode ? (
                            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '16px', alignItems: 'center' }}>
                                <textarea
                                    ref={inputRef}
                                    value={manualText}
                                    onChange={(e) => setManualText(e.target.value)}
                                    placeholder={conversationContext ? "Digite sua resposta..." : "Digite seu gasto aqui..."}
                                    className="manual-text-input"
                                    rows={3}
                                />
                                <button className="send-transcript-btn" onClick={handleSendText} disabled={!manualText.trim() || isProcessing} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Send size={18} /> Processar
                                </button>
                            </div>
                        ) : transcript ? (
                            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
                                <p className="spoken-text">{transcript}</p>
                                {!isProcessing && !isListening && (
                                    <button className="send-transcript-btn" onClick={handleProcessManualClick}>
                                        Analisar
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px', alignItems: 'center' }}>
                                <button
                                    onClick={toggleTextMode}
                                    style={{
                                        background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
                                        borderRadius: '20px', padding: '6px 16px', color: 'white',
                                        display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem',
                                        backdropFilter: 'blur(10px)', cursor: 'pointer'
                                    }}
                                >
                                    <Edit2 size={14} /> Digitar texto
                                </button>
                                <p className="ai-greeting" style={{ marginTop: '0' }}>
                                    {isListening ? (
                                        <>Ouvindo<span className="dots">...</span></>
                                    ) : (
                                        <>A inteligência artificial está <br /> disponível para ajudar</>
                                    )}
                                </p>
                            </div>
                        )
                    ) : null}
                </div>
            </div>

            <style>{`
        .ai-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0; 
          background: rgba(0, 0, 0, 0.5); 
          backdrop-filter: blur(40px);
          -webkit-backdrop-filter: blur(40px);
          z-index: 2000;
          opacity: 0; pointer-events: none;
          transition: opacity 0.5s ease;
        }
        .ai-overlay.active { opacity: 1; pointer-events: auto; }
        
        .ai-minimal-content {
          width: 100%; height: 100%;
          display: flex; flex-direction: column;
          justify-content: flex-start;
          align-items: center;
          padding: 80px 24px;
        }

        .ai-status-text {
          margin-top: 40px;
          text-align: center;
          width: 100%;
        }

        .ai-greeting { 
          font-family: 'Solway', serif;
          font-size: 1.5rem; 
          color: #ffffff; 
          font-weight: 500; 
          line-height: 1.4;
          opacity: 0.9;
        }
        
        .spoken-text { 
           font-family: 'Solway', serif;
           font-size: 1.5rem; 
           color: #ffffff; 
           font-weight: 500; 
           line-height: 1.4; 
        }
        
        .ai-system-message {
           font-family: 'Solway', serif;
           font-size: 1.5rem;
           color: #ffffff;
           font-weight: 500;
           line-height: 1.5;
           text-align: center;
           max-height: 60vh;
           overflow-y: auto;
           padding: 10px;
        }
        
        .dots {
          animation: blink 1.5s infinite both;
        }
        @keyframes blink { 0% { opacity: .2; } 20% { opacity: 1; } 100% { opacity: .2; } }
        

        
        .send-transcript-btn {
          background: var(--primary-darkest); color: white;
          padding: 14px 32px; border-radius: var(--border-radius-full);
          font-weight: 600; font-size: 1.1rem; 
          animation: slideUp 0.3s forwards;
          box-shadow: 0 4px 12px rgba(14, 34, 16, 0.2);
          border: none;
        }

        .send-transcript-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .manual-text-input {
            width: 90%;
            max-width: 400px;
            background: rgba(255,255,255,0.1);
            border: 1px solid rgba(255,255,255,0.3);
            border-radius: 16px;
            padding: 16px;
            color: white;
            font-size: 1.5rem;
            line-height: 1.5;
            font-family: inherit;
            outline: none;
            resize: none;
            backdrop-filter: blur(10px);
            animation: fadeInScale 0.3s forwards;
            text-align: center;
        }

        .manual-text-input::placeholder {
            color: rgba(255,255,255,0.5);
        }
      `}</style>
        </div>
    );
};

export default AiPanel;
