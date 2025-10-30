// Este es un diccionario de ejemplo más grande.
// Para un juego completo, deberás encontrar y pegar una lista
// de miles de palabras de 5 letras sin tildes.

const LISTA_PALABRAS = [
    'plato', 'casa', 'mesa', 'lapiz', 'cinco', 'noche', 'silla', 'roble',
    'piedr', 'verde', 'rojo', 'azul', 'blanco', 'negro', 'gatos', 'perro',
    'reina', 'reyes', 'coche', 'barco', 'agua', 'fuego', 'aire', 'tierra',
    'lucha', 'luces', 'nubes', 'playa', 'abrir', 'beber', 'comer', 'vivir',
    'jugar', 'reloj', 'radio', 'libro', 'saber', 'poder', 'venir', 'decir',
    'hacer', 'bravo', 'calma', 'campo', 'canto', 'claro', 'color', 'costa',
    'culpa', 'danza', 'donde', 'drama', 'error', 'extra', 'falta', 'fibra',
    'firma', 'flota', 'fondo', 'forma', 'frase', 'fruta', 'fuerza', 'gente',
    'globo', 'grado', 'grano', 'grupo', 'guia', 'habil', 'hasta', 'hotel',
    'humor', 'ideas', 'igual', 'jabon', 'joven', 'juez', 'junto', 'labor',
    'largo', 'lento', 'libre', 'linea', 'logro', 'lugar', 'magia', 'marco',
    'mayor', 'medio', 'mejor', 'mente', 'metal', 'miedo', 'mirar', 'motor',
    'mundo', 'museo', 'muslo', 'nuevo', 'orden', 'otro', 'oveja', 'padre',
    'papel', 'parar', 'parte', 'pasar', 'pasta', 'patio', 'pausa', 'pecho',
    'pedir', 'pesar', 'piano', 'pieza', 'pista', 'pluma', 'poeta', 'polvo',
    'precio', 'punto', 'queso', 'razon', 'regla', 'resto', 'ritmo', 'robot',
    'roca', 'ropa', 'rueda', 'ruido', 'arena', 'salto', 'santo', 'sello',
    'selva', 'serie', 'señal', 'sobre', 'socio', 'solar', 'sonido', 'talon',
    'tarde', 'tarea', 'techo', 'tema', 'tenis', 'texto', 'tiempo', 'tinta',
    'titulo', 'tomar', 'traje', 'valor', 'vapor', 'veloz', 'venta', 'viaje',
    'video', 'vista', 'yogur', 'zona', 'zorro', 'amigo', 'calle', 'cielo'
];

// Creamos un "Set" para una búsqueda súper rápida.
// Convertimos todo a minúsculas.
export const DICCIONARIO = new Set(LISTA_PALABRAS.map(p => p.toLowerCase()));