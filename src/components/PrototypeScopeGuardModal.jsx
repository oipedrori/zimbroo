import React from 'react';
import ConfirmDialog from './ConfirmDialog';
import { usePrototypeFinancial } from '../contexts/PrototypeFinancialContext';
import { haptic } from '../utils/haptic';

const PrototypeScopeGuardModal = () => {
    const { blockedNotice, closeBlockedNotice, setFinancialContext } = usePrototypeFinancial();

    if (!blockedNotice) return null;

    const handleSwitchToIndividual = () => {
        haptic.medium();
        setFinancialContext('individual');
        closeBlockedNotice();
    };

    return (
        <ConfirmDialog
            isOpen={Boolean(blockedNotice)}
            onClose={closeBlockedNotice}
            title={blockedNotice.title || 'Ação Não Disponível'}
            message={blockedNotice.message || 'Esta operação não está disponível no contexto atual.'}
            showIcon={true}
            confirmLabel={blockedNotice.allowSwitch ? 'Mudar para Individual' : 'Entendi'}
            cancelLabel={blockedNotice.allowSwitch ? 'Permanecer' : undefined}
            showCancel={Boolean(blockedNotice.allowSwitch)}
            onConfirm={blockedNotice.allowSwitch ? handleSwitchToIndividual : closeBlockedNotice}
            onCancel={closeBlockedNotice}
        />
    );
};

export default PrototypeScopeGuardModal;
