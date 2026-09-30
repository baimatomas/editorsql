'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, KeyRound, User, Play, Sparkles, PenLine, Gamepad2, Trophy } from 'lucide-react'
import { supabase } from './lib/supabase'
import { isValidNickname, friendlyJoinError, PLAYER_SESSION_KEY } from './lib/game'
import type { PlayerSession } from './lib/types'
import { isAdmin, loginTeacher } from './lib/api'

export default function QuizHub() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [nickname, setNickname] = useState('')
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [teacher, setTeacher] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)
  const [loginUser, setLoginUser] = useState('')
  const [loginPass, setLoginPass] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)

  useEffect(() => {
    setTeacher(isAdmin())
  }, [])

  const join = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const gameCode = code.trim()
    const nick = nickname.trim()
    if (!/^\d{6}$/.test(gameCode)) {
      setError('El código tiene 6 dígitos.')
      return
    }
    if (!isValidNickname(nick)) {
      setError('Elegí un nombre de 1 a 20 caracteres.')
      return
    }
    setJoining(true)
    try {
      const { data: game, error: gameErr } = await supabase
        .from('games')
        .select('code, status')
        .eq('code', gameCode)
        .maybeSingle()
      if (gameErr) throw gameErr
      if (!game) throw new Error('El código no corresponde a ninguna partida. Verificalo con el docente.')
      if (game.status === 'ended') throw new Error('Esa partida ya terminó.')

      const { data: player, error: playerErr } = await supabase
        .from('players')
        .insert({ game_code: gameCode, nickname: nick })
        .select()
        .single()
      if (playerErr) throw playerErr

      const session: PlayerSession = {
        gameCode,
        playerId: player.id,
        nickname: nick,
      }
      sessionStorage.setItem(PLAYER_SESSION_KEY, JSON.stringify(session))
      router.push('/quiz/play')
    } catch (err) {
      setError(friendlyJoinError(err))
    } finally {
      setJoining(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError(null)
    try {
      const token = await loginTeacher(loginUser, loginPass)
      localStorage.setItem('editorsql_admin_token', token)
      setTeacher(true)
      setLoginOpen(false)
    } catch (err) {
      setLoginError((err as Error).message)
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-8">
      {/* Barra superior */}
      <div className="w-full max-w-5xl flex items-center justify-between mb-10">
        <a
          href="/"
          className="flex items-center gap-2 text-violet-200/60 hover:text-violet-100 text-sm transition-colors"
        >
          <ArrowLeft size={16} />
          Volver al editor
        </a>
        <div className="flex items-center gap-2 text-sm font-semibold tracking-wide">
          <Sparkles size={16} className="text-fuchsia-300" />
          EditorSQL · Preguntas
        </div>
      </div>

      <div className="w-full max-w-5xl grid md:grid-cols-5 gap-8 items-start flex-1">
        {/* Unirse al juego (alumnos) */}
        <section className="md:col-span-3 preguntas-card p-8 animate-slide-up">
          <h1 className="text-4xl md:text-5xl font-bold mb-2 leading-tight">
            ¡Sumate a la{' '}
            <span className="bg-gradient-to-r from-fuchsia-300 via-violet-300 to-cyan-300 bg-clip-text text-transparent">
              partida
            </span>
            !
          </h1>
          <p className="text-violet-200/60 mb-8">Ingresá el código que muestra el docente y elegí tu nombre.</p>

          <form onSubmit={join} className="space-y-5">
            <div>
              <label className="block text-xs uppercase tracking-widest text-violet-300/70 mb-2">Código de la partida</label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                placeholder="123456"
                className="preguntas-input w-full text-center text-4xl font-bold tracking-[0.4em] py-4"
                autoFocus
              />
            </div>
            <div className="relative">
              <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-violet-300/50" />
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value.slice(0, 20))}
                placeholder="Tu nombre para jugar"
                className="preguntas-input w-full text-lg py-3.5 pl-11 pr-4"
              />
            </div>

            {error && (
              <p className="text-rose-300 text-sm bg-rose-500/10 border border-rose-400/30 rounded-lg px-4 py-2.5 animate-pop-in">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={joining}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-lg
                         bg-gradient-to-r from-fuchsia-500 to-violet-500 hover:from-fuchsia-400 hover:to-violet-400
                         shadow-lg shadow-fuchsia-900/40 hover:shadow-fuchsia-700/50
                         transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]
                         disabled:opacity-50 disabled:hover:scale-100"
            >
              <Play size={20} />
              {joining ? 'Entrando...' : '¡Jugar!'}
            </button>
          </form>
        </section>

        {/* Panel docente */}
        <aside className="md:col-span-2 space-y-4">
          <div className="preguntas-card p-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <div className="flex items-center gap-2 mb-4">
              <PenLine size={18} className="text-violet-300" />
              <h2 className="font-bold text-lg">Panel del docente</h2>
            </div>
            {teacher ? (
              <div className="space-y-3">
                <a
                  href="/quiz/admin"
                  className="flex items-center gap-3 p-3.5 rounded-xl border border-violet-400/25 bg-violet-500/10 hover:bg-violet-500/20 hover:border-violet-300/50 transition-all group"
                >
                  <PenLine size={18} className="text-violet-300 group-hover:scale-110 transition-transform" />
                  <div>
                    <p className="font-semibold text-sm">Gestionar preguntas</p>
                    <p className="text-xs text-violet-200/50">Crear, editar y ordenar el banco</p>
                  </div>
                </a>
                <a
                  href="/quiz/host"
                  className="flex items-center gap-3 p-3.5 rounded-xl border border-fuchsia-400/25 bg-fuchsia-500/10 hover:bg-fuchsia-500/20 hover:border-fuchsia-300/50 transition-all group"
                >
                  <Gamepad2 size={18} className="text-fuchsia-300 group-hover:scale-110 transition-transform" />
                  <div>
                    <p className="font-semibold text-sm">Iniciar partida</p>
                    <p className="text-xs text-violet-200/50">Código en vivo, lobby y puntajes</p>
                  </div>
                </a>
              </div>
            ) : (
              <div>
                <p className="text-sm text-violet-200/60 mb-4">
                  Iniciá sesión con tu cuenta de docente para gestionar preguntas y lanzar partidas.
                </p>
                <button
                  onClick={() => setLoginOpen(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm
                             border border-violet-400/40 bg-violet-500/15 hover:bg-violet-500/30 transition-all"
                >
                  <KeyRound size={16} />
                  Iniciar sesión docente
                </button>
              </div>
            )}
          </div>

          <div className="preguntas-card p-6 animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <div className="flex items-center gap-2 mb-2">
              <Trophy size={18} className="text-amber-300" />
              <h2 className="font-bold text-lg">¿Cómo se juega?</h2>
            </div>
            <ol className="text-sm text-violet-200/60 space-y-2 list-decimal list-inside">
              <li>El docente lanza la partida y muestra un código de 6 dígitos.</li>
              <li>Ingresás el código y tu nombre acá mismo.</li>
              <li>Aparece una pregunta con 4 opciones y un reloj.</li>
              <li>Cuanto más rápido respondas, más puntos ganás.</li>
              <li>Los aciertos seguidos suman bonus de racha.</li>
            </ol>
          </div>
        </aside>
      </div>

      {/* Login docente */}
      {loginOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setLoginOpen(false)}>
          <form
            onSubmit={handleLogin}
            onClick={(e) => e.stopPropagation()}
            className="preguntas-card p-8 w-full max-w-sm m-4 animate-pop-in space-y-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <KeyRound size={18} className="text-violet-300" />
              <h3 className="font-bold text-lg">Acceso docente</h3>
            </div>
            <input
              value={loginUser}
              onChange={(e) => setLoginUser(e.target.value)}
              placeholder="Usuario"
              autoFocus
              className="preguntas-input w-full px-4 py-3 text-sm"
            />
            <input
              type="password"
              value={loginPass}
              onChange={(e) => setLoginPass(e.target.value)}
              placeholder="Contraseña"
              className="preguntas-input w-full px-4 py-3 text-sm"
            />
            {loginError && <p className="text-rose-300 text-sm">{loginError}</p>}
            <button
              type="submit"
              className="w-full py-3 rounded-xl font-semibold bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-400 hover:to-fuchsia-400 transition-all"
            >
              Ingresar
            </button>
          </form>
        </div>
      )}
    </main>
  )
}
