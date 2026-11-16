// PR de prueba exigido por el PDF: debe hacer fallar el CI.
export function trampa() {
  localStorage.setItem('prueba', '1');
}
