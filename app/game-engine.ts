import * as THREE from 'three'

interface GameCallbacks {
  onHealthChange: (health: number) => void
  onAmmoChange: (ammo: number) => void
  onKill: () => void
  onDeath: () => void
  onHit: () => void
}

interface Enemy {
  mesh: THREE.Mesh
  velocity: THREE.Vector3
  health: number
  lastShot: number
  target: THREE.Vector3
  moveTimer: number
}

export default class GameEngine {
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private renderer: THREE.WebGLRenderer
  private callbacks: GameCallbacks
  private clock: THREE.Clock
  private raycaster: THREE.Raycaster

  // Player state
  private playerHealth = 100
  private playerAmmo = 30
  private playerReserveAmmo = 90
  private isReloading = false

  // Movement
  private moveForward = false
  private moveBackward = false
  private moveLeft = false
  private moveRight = false
  private canJump = false
  private velocity = new THREE.Vector3()
  private direction = new THREE.Vector3()

  // Mouse
  private euler = new THREE.Euler(0, 0, 0, 'YXZ')
  private isLocked = false

  // Game objects
  private enemies: Enemy[] = []
  private bullets: THREE.Mesh[] = []
  private ground: THREE.Mesh
  private walls: THREE.Mesh[] = []

  // Audio context for gunshot sounds
  private audioContext: AudioContext | null = null

  constructor(callbacks: GameCallbacks) {
    this.callbacks = callbacks
    this.clock = new THREE.Clock()
    this.raycaster = new THREE.Raycaster()

    // Scene setup
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x87ceeb)
    this.scene.fog = new THREE.Fog(0x87ceeb, 0, 300)

    // Camera setup
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    )
    this.camera.position.y = 10

    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap

    const canvas = document.getElementById('game-canvas')
    if (canvas) {
      canvas.appendChild(this.renderer.domElement)
    }

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    this.scene.add(ambientLight)

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8)
    dirLight.position.set(50, 100, 50)
    dirLight.castShadow = true
    dirLight.shadow.camera.left = -100
    dirLight.shadow.camera.right = 100
    dirLight.shadow.camera.top = 100
    dirLight.shadow.camera.bottom = -100
    dirLight.shadow.mapSize.width = 2048
    dirLight.shadow.mapSize.height = 2048
    this.scene.add(dirLight)

    // Create ground
    const groundGeometry = new THREE.PlaneGeometry(200, 200)
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x808080,
      roughness: 0.8
    })
    this.ground = new THREE.Mesh(groundGeometry, groundMaterial)
    this.ground.rotation.x = -Math.PI / 2
    this.ground.receiveShadow = true
    this.scene.add(this.ground)

    // Create arena walls
    this.createArena()

    // Create cover objects
    this.createCover()

    // Spawn initial enemies
    this.spawnEnemies(5)

    // Event listeners
    this.setupControls()

    // Window resize
    window.addEventListener('resize', this.onWindowResize.bind(this))
  }

  private createArena() {
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x8b4513 })
    const wallHeight = 20
    const arenaSize = 100

    // North wall
    const wallGeometry1 = new THREE.BoxGeometry(arenaSize * 2, wallHeight, 2)
    const wall1 = new THREE.Mesh(wallGeometry1, wallMaterial)
    wall1.position.set(0, wallHeight / 2, -arenaSize)
    wall1.castShadow = true
    wall1.receiveShadow = true
    this.scene.add(wall1)
    this.walls.push(wall1)

    // South wall
    const wall2 = new THREE.Mesh(wallGeometry1, wallMaterial)
    wall2.position.set(0, wallHeight / 2, arenaSize)
    wall2.castShadow = true
    wall2.receiveShadow = true
    this.scene.add(wall2)
    this.walls.push(wall2)

    // East wall
    const wallGeometry2 = new THREE.BoxGeometry(2, wallHeight, arenaSize * 2)
    const wall3 = new THREE.Mesh(wallGeometry2, wallMaterial)
    wall3.position.set(arenaSize, wallHeight / 2, 0)
    wall3.castShadow = true
    wall3.receiveShadow = true
    this.scene.add(wall3)
    this.walls.push(wall3)

    // West wall
    const wall4 = new THREE.Mesh(wallGeometry2, wallMaterial)
    wall4.position.set(-arenaSize, wallHeight / 2, 0)
    wall4.castShadow = true
    wall4.receiveShadow = true
    this.scene.add(wall4)
    this.walls.push(wall4)
  }

  private createCover() {
    const boxMaterial = new THREE.MeshStandardMaterial({ color: 0x654321 })

    const positions = [
      [20, 30],
      [-20, 30],
      [20, -30],
      [-20, -30],
      [40, 0],
      [-40, 0],
      [0, 40],
      [0, -40]
    ]

    positions.forEach(([x, z]) => {
      const boxGeometry = new THREE.BoxGeometry(8, 10, 8)
      const box = new THREE.Mesh(boxGeometry, boxMaterial)
      box.position.set(x, 5, z)
      box.castShadow = true
      box.receiveShadow = true
      this.scene.add(box)
      this.walls.push(box)
    })
  }

  private spawnEnemies(count: number) {
    const enemyGeometry = new THREE.BoxGeometry(4, 12, 4)
    const enemyMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 })

    for (let i = 0; i < count; i++) {
      const enemy = new THREE.Mesh(enemyGeometry, enemyMaterial)

      // Random spawn position
      let x, z
      do {
        x = (Math.random() - 0.5) * 160
        z = (Math.random() - 0.5) * 160
      } while (Math.abs(x) < 20 && Math.abs(z) < 20) // Don't spawn near player

      enemy.position.set(x, 6, z)
      enemy.castShadow = true
      enemy.receiveShadow = true
      this.scene.add(enemy)

      this.enemies.push({
        mesh: enemy,
        velocity: new THREE.Vector3(),
        health: 100,
        lastShot: 0,
        target: new THREE.Vector3(x, 6, z),
        moveTimer: 0
      })
    }
  }

  private setupControls() {
    document.addEventListener('keydown', (e) => this.onKeyDown(e))
    document.addEventListener('keyup', (e) => this.onKeyUp(e))
    document.addEventListener('mousedown', (e) => this.onMouseDown(e))
    document.addEventListener('click', () => {
      if (!this.isLocked) {
        this.renderer.domElement.requestPointerLock()
      }
    })

    document.addEventListener('pointerlockchange', () => {
      this.isLocked = document.pointerLockElement === this.renderer.domElement
    })

    document.addEventListener('mousemove', (e) => this.onMouseMove(e))
  }

  private onKeyDown(event: KeyboardEvent) {
    switch (event.code) {
      case 'KeyW':
        this.moveForward = true
        break
      case 'KeyS':
        this.moveBackward = true
        break
      case 'KeyA':
        this.moveLeft = true
        break
      case 'KeyD':
        this.moveRight = true
        break
      case 'Space':
        if (this.canJump) this.velocity.y += 15
        this.canJump = false
        break
      case 'KeyR':
        this.reload()
        break
    }
  }

  private onKeyUp(event: KeyboardEvent) {
    switch (event.code) {
      case 'KeyW':
        this.moveForward = false
        break
      case 'KeyS':
        this.moveBackward = false
        break
      case 'KeyA':
        this.moveLeft = false
        break
      case 'KeyD':
        this.moveRight = false
        break
    }
  }

  private onMouseMove(event: MouseEvent) {
    if (!this.isLocked) return

    const movementX = event.movementX || 0
    const movementY = event.movementY || 0

    this.euler.setFromQuaternion(this.camera.quaternion)
    this.euler.y -= movementX * 0.002
    this.euler.x -= movementY * 0.002
    this.euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.euler.x))

    this.camera.quaternion.setFromEuler(this.euler)
  }

  private onMouseDown(event: MouseEvent) {
    if (!this.isLocked || event.button !== 0) return
    this.shoot()
  }

  private shoot() {
    if (this.playerAmmo <= 0 || this.isReloading) return

    this.playerAmmo--
    this.callbacks.onAmmoChange(this.playerAmmo)

    // Play gunshot sound
    this.playGunshot()

    // Raycasting for hit detection
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera)
    const intersects = this.raycaster.intersectObjects(
      this.enemies.map(e => e.mesh)
    )

    if (intersects.length > 0) {
      const hitEnemy = this.enemies.find(e => e.mesh === intersects[0].object)
      if (hitEnemy) {
        hitEnemy.health -= 34
        this.callbacks.onHit()

        if (hitEnemy.health <= 0) {
          this.killEnemy(hitEnemy)
        }
      }
    }

    // Camera recoil
    this.camera.rotation.x += (Math.random() - 0.5) * 0.02
    this.camera.rotation.y += (Math.random() - 0.5) * 0.02
  }

  private reload() {
    if (this.isReloading || this.playerAmmo === 30) return

    this.isReloading = true
    const needed = 30 - this.playerAmmo
    const toReload = Math.min(needed, this.playerReserveAmmo)

    setTimeout(() => {
      this.playerAmmo += toReload
      this.playerReserveAmmo -= toReload
      this.callbacks.onAmmoChange(this.playerAmmo)
      this.isReloading = false
    }, 1500)
  }

  private killEnemy(enemy: Enemy) {
    this.scene.remove(enemy.mesh)
    this.enemies = this.enemies.filter(e => e !== enemy)
    this.callbacks.onKill()

    // Spawn new enemy
    if (this.enemies.length < 5) {
      this.spawnEnemies(1)
    }
  }

  private playGunshot() {
    if (!this.audioContext) {
      this.audioContext = new AudioContext()
    }

    const ctx = this.audioContext
    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)

    oscillator.frequency.value = 100
    oscillator.type = 'sawtooth'

    gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1)

    oscillator.start(ctx.currentTime)
    oscillator.stop(ctx.currentTime + 0.1)
  }

  private updateEnemies(delta: number) {
    const currentTime = Date.now()

    this.enemies.forEach(enemy => {
      // Update target position periodically
      enemy.moveTimer += delta
      if (enemy.moveTimer > 2) {
        enemy.moveTimer = 0

        // 70% chance to move towards player, 30% random
        if (Math.random() > 0.3) {
          const dirToPlayer = new THREE.Vector3()
          dirToPlayer.subVectors(this.camera.position, enemy.mesh.position)
          dirToPlayer.y = 0
          dirToPlayer.normalize()

          enemy.target.copy(enemy.mesh.position)
          enemy.target.add(dirToPlayer.multiplyScalar(20))
        } else {
          enemy.target.set(
            (Math.random() - 0.5) * 160,
            6,
            (Math.random() - 0.5) * 160
          )
        }
      }

      // Move towards target
      const direction = new THREE.Vector3()
      direction.subVectors(enemy.target, enemy.mesh.position)
      direction.y = 0

      if (direction.length() > 2) {
        direction.normalize()
        enemy.velocity.x = direction.x * 15
        enemy.velocity.z = direction.z * 15

        enemy.mesh.position.x += enemy.velocity.x * delta
        enemy.mesh.position.z += enemy.velocity.z * delta

        // Look at target
        enemy.mesh.lookAt(enemy.target)
      }

      // Shoot at player
      const distToPlayer = enemy.mesh.position.distanceTo(this.camera.position)
      if (distToPlayer < 50 && currentTime - enemy.lastShot > 2000) {
        enemy.lastShot = currentTime

        // Check if player is visible
        const direction = new THREE.Vector3()
        direction.subVectors(this.camera.position, enemy.mesh.position)
        direction.normalize()

        this.raycaster.set(enemy.mesh.position, direction)
        const intersects = this.raycaster.intersectObjects(this.walls)

        if (intersects.length === 0 || intersects[0].distance > distToPlayer) {
          // Hit player with some accuracy
          if (Math.random() > 0.3) {
            this.playerHealth -= 10
            this.callbacks.onHealthChange(this.playerHealth)

            if (this.playerHealth <= 0) {
              this.callbacks.onDeath()
            }
          }
        }
      }
    })
  }

  private updatePlayer(delta: number) {
    // Damping
    this.velocity.x -= this.velocity.x * 10.0 * delta
    this.velocity.z -= this.velocity.z * 10.0 * delta
    this.velocity.y -= 9.8 * 10.0 * delta // gravity

    this.direction.z = Number(this.moveForward) - Number(this.moveBackward)
    this.direction.x = Number(this.moveRight) - Number(this.moveLeft)
    this.direction.normalize()

    if (this.moveForward || this.moveBackward) {
      this.velocity.z -= this.direction.z * 100.0 * delta
    }
    if (this.moveLeft || this.moveRight) {
      this.velocity.x -= this.direction.x * 100.0 * delta
    }

    const prevPosition = this.camera.position.clone()

    this.camera.translateX(this.velocity.x * delta)
    this.camera.translateZ(this.velocity.z * delta)
    this.camera.position.y += this.velocity.y * delta

    // Collision detection with walls
    const playerBox = new THREE.Box3().setFromCenterAndSize(
      this.camera.position,
      new THREE.Vector3(2, 10, 2)
    )

    for (const wall of this.walls) {
      const wallBox = new THREE.Box3().setFromObject(wall)
      if (playerBox.intersectsBox(wallBox)) {
        this.camera.position.copy(prevPosition)
        this.velocity.x = 0
        this.velocity.z = 0
        break
      }
    }

    // Ground collision
    if (this.camera.position.y < 10) {
      this.velocity.y = 0
      this.camera.position.y = 10
      this.canJump = true
    }

    // Arena bounds
    this.camera.position.x = Math.max(-95, Math.min(95, this.camera.position.x))
    this.camera.position.z = Math.max(-95, Math.min(95, this.camera.position.z))
  }

  private animate() {
    if (!this.isLocked) return

    const delta = this.clock.getDelta()

    this.updatePlayer(delta)
    this.updateEnemies(delta)

    this.renderer.render(this.scene, this.camera)
  }

  private onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(window.innerWidth, window.innerHeight)
  }

  public start() {
    const animate = () => {
      requestAnimationFrame(animate)
      this.animate()
    }
    animate()
  }

  public dispose() {
    this.renderer.dispose()
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement)
    }
    if (this.audioContext) {
      this.audioContext.close()
    }
  }
}
