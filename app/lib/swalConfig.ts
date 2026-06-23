export function swalTheme(overrides: Record<string, unknown> = {}) {
  const isLight = typeof document !== 'undefined'
    && document.documentElement.getAttribute('data-theme') === 'light'

  return {
    background: isLight ? '#ffffff' : '#1f1f23',
    color: isLight ? '#1f2937' : '#d4d4d4',
    confirmButtonColor: '#4f46e5',
    cancelButtonColor: isLight ? '#9ca3af' : '#6c6c6c',
    reverseButtons: true,
    width: 380,
    padding: '1.25rem',
    customClass: {
      popup: 'swal-popup',
      title: 'swal-title',
      htmlContainer: 'swal-html',
      confirmButton: 'swal-confirm',
      cancelButton: 'swal-cancel',
      input: 'swal-input',
    },
    ...overrides,
  }
}
