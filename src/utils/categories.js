export const CATEGORIAS_DESPESA = [
    { id: 'alimentacao', label: 'Alimentação', icon: '🥑', color: '#FCD34D' }, // Amber 300
    { id: 'comunicacao', label: 'Comunicação', icon: '📱', color: '#A5B4FC' }, // Indigo 300
    { id: 'doacao', label: 'Doação', icon: '🤲', color: '#C4B5FD' }, // Violet 300
    { id: 'educacao', label: 'Educação', icon: '📚', color: '#93C5FD' }, // Blue 300
    { id: 'equipamentos', label: 'Equipamentos', icon: '💻', color: '#5EEAD4' }, // Teal 300
    { id: 'impostos', label: 'Impostos', icon: '🏛️', color: '#CBD5E1' }, // Slate 300
    { id: 'investimento', label: 'Investimento', icon: '📈', color: '#F9A8D4' }, // Pink 300
    { id: 'lazer', label: 'Lazer', icon: '🎭', color: '#FDA4AF' }, // Rose 300
    { id: 'moradia', label: 'Moradia', icon: '🏠', color: '#7DD3FC' }, // Sky 300
    { id: 'pet', label: 'Pet', icon: '🐾', color: '#FDBA74' }, // Orange 300
    { id: 'saude', label: 'Saúde', icon: '💊', color: '#F5D0FE' }, // Fuchsia 300
    { id: 'seguro', label: 'Seguro', icon: '🛡️', color: '#67E8F9' }, // Cyan 300
    { id: 'transporte', label: 'Transporte', icon: '🚗', color: '#D8B4FE' }, // Purple 300
    { id: 'vestuario', label: 'Vestuário', icon: '👕', color: '#86EFAC' }, // Green 300
    { id: 'higiene', label: 'Higiene Pessoal', icon: '🪥', color: '#BEF264' }, // Lime 300
    { id: 'outros', label: 'Outros', icon: '📌', color: '#D1D5DB' }, // Gray 300
];

export const CATEGORIAS_RECEITA = [
    { id: 'salario', label: 'Salário', icon: '💵', color: '#6EE7B7' }, // Emerald 300
    { id: 'freela', label: 'Freelance', icon: '💼', color: '#93C5FD' }, // Blue 300
    { id: 'investimento', label: 'Rendimentos', icon: '📈', color: '#C4B5FD' }, // Violet 300
    { id: 'reembolso', label: 'Reembolso', icon: '🔄', color: '#FCD34D' }, // Amber 300
    { id: 'outros', label: 'Outros', icon: '➕', color: '#D1D5DB' }, // Gray 300
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
