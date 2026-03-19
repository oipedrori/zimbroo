import React, { useState } from 'react';
import { Trash2, Edit2 } from 'lucide-react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';

const SwipeableItem = ({ children, onDelete, onEdit }) => {
    const [isDeleted, setIsDeleted] = useState(false);
    const x = useMotionValue(0);

    // Transformações para efeitos visuais durante o arraste
    const opacity = useTransform(x, [-100, -80, 0, 80, 100], [0.5, 1, 1, 1, 0.5]);
    const scale = useTransform(x, [-100, -80, 0, 80, 100], [0.95, 1, 1, 1, 0.95]);

    const handleDragEnd = (event, info) => {
        const { offset, velocity } = info;
        
        // Thresholds para "magnetismo"
        // Se a velocidade for alta ou o arraste passar de 40px, ele "estala" para a posição
        if (offset.x < -40 || velocity.x < -500) {
            animate(x, -80, { type: 'spring', bounce: 0.2, duration: 0.4 });
        } else if (onEdit && (offset.x > 40 || velocity.x > 500)) {
            animate(x, 80, { type: 'spring', bounce: 0.2, duration: 0.4 });
        } else {
            animate(x, 0, { type: 'spring', bounce: 0.2, duration: 0.4 });
        }
    };

    const handleDeleteClick = () => {
        setIsDeleted(true);
        setTimeout(() => {
            onDelete();
        }, 300);
    };

    const handleEditClick = () => {
        animate(x, 0, { type: 'spring', bounce: 0.2, duration: 0.4 });
        if (onEdit) onEdit();
    };

    if (isDeleted) {
        return (
            <motion.div 
                initial={{ height: 'auto', opacity: 1 }}
                animate={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                style={{ overflow: 'hidden' }}
            >
                {children}
            </motion.div>
        );
    }

    return (
        <div style={{ position: 'relative', overflow: 'hidden', width: '100%', borderRadius: '16px' }}>
            {/* Background Actions Container */}
            <div style={{
                position: 'absolute',
                top: 0, bottom: 0, left: 0, right: 0,
                display: 'flex',
                justifyContent: 'space-between',
                zIndex: 0
            }}>
                {/* Left Side (Edit) */}
                <div style={{
                    width: '100px',
                    background: 'var(--success-color)',
                    display: 'flex',
                    justifyContent: 'flex-start',
                    alignItems: 'center',
                    borderRadius: '16px 0 0 16px',
                    paddingLeft: '20px',
                    opacity: onEdit ? 1 : 0
                }}>
                    {onEdit && (
                        <button
                            onClick={handleEditClick}
                            style={{ color: 'white', background: 'transparent', border: 'none', cursor: 'pointer', padding: '10px' }}
                            aria-label="Editar"
                        >
                            <Edit2 size={24} />
                        </button>
                    )}
                </div>

                {/* Right Side (Delete) */}
                <div style={{
                    width: '100px',
                    background: 'var(--danger-color)',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                    borderRadius: '0 16px 16px 0',
                    paddingRight: '20px'
                }}>
                    <button
                        onClick={handleDeleteClick}
                        style={{ color: 'white', background: 'transparent', border: 'none', cursor: 'pointer', padding: '10px' }}
                        aria-label="Apagar"
                    >
                        <Trash2 size={24} />
                    </button>
                </div>
            </div>

            {/* Foreground Item */}
            <motion.div
                drag="x"
                dragConstraints={{ left: -80, right: onEdit ? 80 : 0 }}
                dragElastic={0.1}
                onDragEnd={handleDragEnd}
                style={{
                    x,
                    opacity,
                    scale,
                    background: 'var(--surface-color)',
                    width: '100%',
                    position: 'relative',
                    zIndex: 1,
                    display: 'flex',
                    cursor: 'grab',
                    touchAction: 'none' // Importante para drag no mobile
                }}
                whileTap={{ cursor: 'grabbing' }}
            >
                <div style={{ width: '100%' }}>
                    {children}
                </div>
            </motion.div>
        </div>
    );
};

export default SwipeableItem;
