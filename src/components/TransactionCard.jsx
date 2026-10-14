import React from 'react';
import { useI18n } from '../contexts/I18nContext';
import { getCategoryInfo } from '../utils/categories';
import { getEmojiForDescription } from '../utils/emojiUtils';

const TransactionCard = ({ transaction, onClick }) => {
  const { t, formatCurrency } = useI18n();

  const getCategoryTheme = (id, type) => {
    return getCategoryInfo(id, type);
  };

  const tx = transaction;
  const categoryTheme = getCategoryTheme(tx.category || tx.cat, tx.type || tx.tipo);

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 16px',
        background: 'transparent',
        cursor: onClick ? 'pointer' : 'default'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{
          width: '42px', height: '42px', borderRadius: '12px',
          background: categoryTheme.color + '20',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          color: categoryTheme.color, fontWeight: 'bold', fontSize: '1.2rem', flexShrink: 0
        }}>
          {getEmojiForDescription(tx.description || tx.desc, categoryTheme.icon)}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <p style={{ fontWeight: '500', margin: 0, color: 'var(--text-main)' }}>
            {tx.dynamicDescription || tx.description || tx.desc}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
              {(tx.virtualDate || tx.date || '').split('-').slice(1).reverse().join('/')}
            </p>
            {tx.scope === 'family' && (
              <span style={{
                fontSize: '0.65rem',
                padding: '1px 6px',
                borderRadius: '6px',
                background: 'rgba(99, 102, 241, 0.12)',
                color: '#6366f1',
                fontWeight: '700',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px'
              }}>
                Familiar{tx.memberName ? ` • ${tx.memberName}` : ''}
              </span>
            )}
            {tx.scope === 'individual' && tx.originLabel && (
              <span style={{
                fontSize: '0.65rem',
                padding: '1px 6px',
                borderRadius: '6px',
                background: 'rgba(16, 185, 129, 0.12)',
                color: '#10b981',
                fontWeight: '700'
              }}>
                Individual
              </span>
            )}
            {(tx.repeatType || tx.tipo_recorrencia) && (tx.repeatType !== 'none' && tx.tipo_recorrencia !== 'none') && (
              <span style={{
                fontSize: '0.65rem',
                padding: '1px 6px',
                borderRadius: '6px',
                background: 'rgba(75, 180, 90, 0.1)',
                color: '#4BB45A',
                fontWeight: '700',
                textTransform: 'uppercase'
              }}>
                {(tx.repeatType === 'recurring' || tx.tipo_recorrencia === 'recurring') ? t('tag_recurring') :
                  (tx.repeatType === 'installment' || tx.installments > 1) ? t('tag_installment') : t('tag_variable')}
              </span>
            )}
          </div>
        </div>
      </div>
      <p style={{ fontWeight: '600', color: (tx.type === 'income' || tx.tipo === 'receita') ? 'var(--success-color)' : 'var(--danger-color)', margin: 0, whiteSpace: 'nowrap' }}>
        {(tx.type === 'income' || tx.tipo === 'receita') ? '+' : '-'} {formatCurrency(tx.amount || tx.val)}
      </p>
    </div>
  );
};

export default TransactionCard;
