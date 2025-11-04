'use client'

import { useEffect, useRef, useState } from 'react'

export default function Game() {
  const [gameStarted, setGameStarted] = useState(false)
  const [health, setHealth] = useState(100)
  const [ammo, setAmmo] = useState(30)
  const [kills, setKills] = useState(0)
  const [deaths, setDeaths] = useState(0)
  const [gameOver, setGameOver] = useState(false)
  const [showHitMarker, setShowHitMarker] = useState(false)
  const gameRef = useRef<any>(null)

  useEffect(() => {
    if (!gameStarted) return

    const initGame = async () => {
      const { default: GameEngine } = await import('./game-engine')

      const engine = new GameEngine({
        onHealthChange: setHealth,
        onAmmoChange: setAmmo,
        onKill: () => setKills(k => k + 1),
        onDeath: () => {
          setDeaths(d => d + 1)
          setGameOver(true)
        },
        onHit: () => {
          setShowHitMarker(true)
          setTimeout(() => setShowHitMarker(false), 100)
        }
      })

      gameRef.current = engine
      engine.start()
    }

    initGame()

    return () => {
      if (gameRef.current) {
        gameRef.current.dispose()
      }
    }
  }, [gameStarted])

  const startGame = () => {
    setGameStarted(true)
    setHealth(100)
    setAmmo(30)
    setGameOver(false)
  }

  const restartGame = () => {
    if (gameRef.current) {
      gameRef.current.dispose()
    }
    setGameStarted(false)
    setHealth(100)
    setAmmo(30)
    setKills(0)
    setDeaths(0)
    setGameOver(false)
    setTimeout(() => startGame(), 100)
  }

  if (!gameStarted) {
    return (
      <div className="menu">
        <h1>FPS STRIKE</h1>
        <button onClick={startGame}>START GAME</button>
        <div className="instructions">
          <p>WASD - Move</p>
          <p>Mouse - Look Around</p>
          <p>Left Click - Shoot</p>
          <p>R - Reload</p>
          <p>ESC - Pause</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div id="game-canvas"></div>
      <div className="hud">
        <div className="crosshair"></div>
        <div className={`hit-marker ${showHitMarker ? 'show' : ''}`}></div>
        <div className="health-bar">HP: {health}</div>
        <div className="ammo-counter">{ammo} / 90</div>
        <div className="weapon-name">AK-47</div>
        <div className="score-board">
          <div>KILLS: {kills} | DEATHS: {deaths}</div>
        </div>
      </div>
      {gameOver && (
        <div className="game-over">
          <h2>YOU DIED</h2>
          <p>Kills: {kills}</p>
          <p>Deaths: {deaths}</p>
          <button onClick={restartGame}>RESPAWN</button>
        </div>
      )}
    </>
  )
}
