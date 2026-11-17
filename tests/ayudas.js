// Utilidades compartidas por las pruebas del juego (no es un archivo de pruebas)

// Generador de azar con semilla (mulberry32): mismas jugadas en cada ejecución
export function rngConSemilla(semilla = 1) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Coloca a los países donde se indique para preparar una situación concreta
export function colocar(estado, posiciones) {
  for (const [id, x, y] of posiciones) {
    const j = estado.jugadores.find(p => p.id === id);
    j.x = x;
    j.y = y;
  }
  return estado;
}

export const sinIA = () => null;
