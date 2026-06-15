export const CATEGORIAS_DESPESA = [
    { id: 'alimentacao', label: 'Alimentação', icon: '🥑', color: '#FAD5B4' }, // Orange
    { id: 'comunicacao', label: 'Comunicação', icon: '📱', color: '#B3DDE0' }, // Cian
    { id: 'doacao', label: 'Doação', icon: '🤲', color: '#E4C8E7' }, // Purple
    { id: 'educacao', label: 'Educação', icon: '📚', color: '#CAD2EE' }, // Blue
    { id: 'equipamentos', label: 'Equipamentos', icon: '💻', color: '#DBCBCE' }, // Gray
    { id: 'impostos', label: 'Impostos', icon: '🏛️', color: '#DBCBCE' }, // Gray
    { id: 'investimento', label: 'Investimento', icon: '📈', color: '#D0E3C9' }, // Green
    { id: 'lazer', label: 'Lazer', icon: '🎭', color: '#FFD2CE' }, // Pink
    { id: 'moradia', label: 'Moradia', icon: '🏠', color: '#F8E9B7' }, // Yellow
    { id: 'pet', label: 'Pet', icon: '🐾', color: '#FAD5B4' }, // Orange
    { id: 'saude', label: 'Saúde', icon: '💊', color: '#FFD2CE' }, // Pink
    { id: 'seguro', label: 'Seguro', icon: '🛡️', color: '#B3DDE0' }, // Cian
    { id: 'transporte', label: 'Transporte', icon: '🚗', color: '#E4C8E7' }, // Purple
    { id: 'vestuario', label: 'Vestuário', icon: '👕', color: '#FFD2CE' }, // Pink
    { id: 'higiene', label: 'Higiene Pessoal', icon: '🪥', color: '#D0E3C9' }, // Green
    { id: 'assinaturas', label: 'Assinaturas', icon: '💎', color: '#CAD2EE' }, // Blue
    { id: 'outros', label: 'Outros', icon: '📌', color: '#DBCBCE' }, // Gray
];

export const CATEGORIAS_RECEITA = [
    { id: 'salario', label: 'Salário', icon: '💵', color: '#D0E3C9' }, // Green
    { id: 'freela', label: 'Freelance', icon: '💼', color: '#CAD2EE' }, // Blue
    { id: 'investimento', label: 'Rendimentos', icon: '📈', color: '#F8E9B7' }, // Yellow
    { id: 'reembolso', label: 'Reembolso', icon: '🔄', color: '#FAD5B4' }, // Orange
    { id: 'outros', label: 'Outros', icon: '➕', color: '#DBCBCE' }, // Gray
];

export const getCategoryInfo = (id, type = 'expense') => {
    const list = type === 'income' ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA;
    if (!id) return list[list.length - 1]; // Fallback para "Outros"
    
    const lowerId = id.toString().toLowerCase();
    
    // Tenta por ID primeiro, depois por Label
    return list.find(c => c.id.toLowerCase() === lowerId) || 
           list.find(c => c.label.toLowerCase() === lowerId) || 
           list[list.length - 1]; // Fallback para "Outros"
};
