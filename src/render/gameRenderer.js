import * as THREE from "three";
import { MAX_WIDTH } from "../simulation/levels.js";
import { cellsFor, PIECE_COLORS } from "../simulation/pieces.js";

const BLOCK_SIZE = 1;
const GAP = 0.055;
const BLOCK_DEPTH = 0.72;

function createSeededRng(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function colorToRgb(color) {
  return {
    r: (color >> 16) & 255,
    g: (color >> 8) & 255,
    b: color & 255
  };
}

export class GameRenderer {
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = false;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.append(this.renderer.domElement);

    this.blocks = new Map();
    this.borderObjects = [];
    this.particles = [];
    this.bombBursts = [];
    this.lastSnapshot = null;
    this.clearAnimation = null;
    this.clock = new THREE.Clock();

    this.blockGeometry = new THREE.BoxGeometry(
      BLOCK_SIZE - GAP,
      BLOCK_SIZE - GAP,
      BLOCK_DEPTH
    );
    this.blockGeometry.translate(0, 0, BLOCK_DEPTH / 2);
    this.edgeGeometry = new THREE.EdgesGeometry(this.blockGeometry);
    this.shadowGeometry = new THREE.PlaneGeometry(BLOCK_SIZE - GAP, BLOCK_SIZE - GAP);
    this.shadowMaterial = new THREE.MeshBasicMaterial({
      color: 0x130d0b,
      transparent: true,
      opacity: 0.34,
      depthWrite: false
    });
    this.edgeMaterial = new THREE.LineBasicMaterial({
      color: 0x351813,
      transparent: true,
      opacity: 0.72
    });
    this.borderMaterial = new THREE.MeshStandardMaterial({
      color: 0x211c18,
      roughness: 0.88,
      metalness: 0.02
    });
    this.inactiveMaterial = new THREE.MeshBasicMaterial({
      color: 0x140f0d,
      transparent: true,
      opacity: 0.22,
      depthWrite: false
    });
    this.particleMaterial = new THREE.MeshBasicMaterial({
      color: 0xe0a58e,
      transparent: true,
      opacity: 0.72,
      depthWrite: false
    });
    this.bombHaloMaterial = new THREE.MeshBasicMaterial({
      map: this.createGlowTexture(),
      color: 0xff7a2e,
      transparent: true,
      opacity: 0.58,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.bombBadgeMaterial = new THREE.MeshBasicMaterial({
      map: this.createBombBadgeTexture(),
      transparent: true,
      depthWrite: false
    });
    this.materials = new Map();

    this.boardGroup = new THREE.Group();
    this.scene.add(this.boardGroup);
    this.setupScene();
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  setupScene() {
    this.scene.background = new THREE.Color(0x312f2a);

    const ambient = new THREE.HemisphereLight(0xffead9, 0x1e1714, 1.35);
    this.scene.add(ambient);

    const key = new THREE.DirectionalLight(0xffd5b4, 3.7);
    key.position.set(-8, -10, 18);
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0xd7c0ad, 0.55);
    fill.position.set(8, 6, 10);
    this.scene.add(fill);

    this.backgroundPlane = this.createConcretePlane();
    this.scene.add(this.backgroundPlane);
  }

  createConcretePlane() {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    const rng = createSeededRng(5077);
    ctx.fillStyle = "#77726a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < 2200; i += 1) {
      const shade = 82 + rng() * 58;
      ctx.fillStyle = `rgba(${shade}, ${shade - 4}, ${shade - 11}, ${0.035 + rng() * 0.08})`;
      ctx.fillRect(rng() * 512, rng() * 512, 1 + rng() * 4, 1 + rng() * 4);
    }
    for (let i = 0; i < 28; i += 1) {
      ctx.strokeStyle = `rgba(46, 43, 39, ${0.08 + rng() * 0.1})`;
      ctx.lineWidth = 0.7 + rng() * 1.3;
      ctx.beginPath();
      ctx.moveTo(rng() * 512, rng() * 512);
      ctx.bezierCurveTo(
        rng() * 512,
        rng() * 512,
        rng() * 512,
        rng() * 512,
        rng() * 512,
        rng() * 512
      );
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 4);
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      color: 0x908980,
      roughness: 0.92,
      metalness: 0
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), material);
    plane.position.z = -0.08;
    return plane;
  }

  getMaterial(type) {
    if (this.materials.has(type)) return this.materials.get(type);

    const color = PIECE_COLORS[type] ?? PIECE_COLORS.filler;
    if (type === "bomb") {
      const { colorCanvas, bumpCanvas } = this.createBombCanvases();
      const texture = new THREE.CanvasTexture(colorCanvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const bumpTexture = new THREE.CanvasTexture(bumpCanvas);
      const material = new THREE.MeshStandardMaterial({
        map: texture,
        bumpMap: bumpTexture,
        bumpScale: 0.1,
        color,
        roughness: 0.48,
        metalness: 0.38,
        emissive: 0x3e0d07,
        emissiveIntensity: 0.45
      });
      this.materials.set(type, material);
      return material;
    }

    const { colorCanvas, bumpCanvas } = this.createBrickCanvases(color, type);

    const texture = new THREE.CanvasTexture(colorCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    const bumpTexture = new THREE.CanvasTexture(bumpCanvas);
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      bumpMap: bumpTexture,
      bumpScale: 0.16,
      color,
      roughness: 0.86,
      metalness: 0.01
    });
    this.materials.set(type, material);
    return material;
  }

  createBrickCanvases(color, type) {
    const colorCanvas = document.createElement("canvas");
    const bumpCanvas = document.createElement("canvas");
    colorCanvas.width = 128;
    colorCanvas.height = 128;
    bumpCanvas.width = 128;
    bumpCanvas.height = 128;

    const ctx = colorCanvas.getContext("2d");
    const bump = bumpCanvas.getContext("2d");
    const rng = createSeededRng(color ^ type.charCodeAt(0) * 4099);
    const base = colorToRgb(color);

    const gradient = ctx.createLinearGradient(0, 0, 128, 128);
    gradient.addColorStop(0, `rgb(${Math.min(255, base.r + 34)}, ${Math.min(255, base.g + 22)}, ${Math.min(255, base.b + 16)})`);
    gradient.addColorStop(0.52, `rgb(${base.r}, ${base.g}, ${base.b})`);
    gradient.addColorStop(1, `rgb(${Math.max(0, base.r - 34)}, ${Math.max(0, base.g - 26)}, ${Math.max(0, base.b - 22)})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);

    bump.fillStyle = "#727272";
    bump.fillRect(0, 0, 128, 128);

    for (let i = 0; i < 90; i += 1) {
      const x = rng() * 128;
      const y = rng() * 128;
      const radius = 1.1 + rng() * 4.4;
      const alpha = 0.08 + rng() * 0.18;
      ctx.fillStyle = rng() > 0.38
        ? `rgba(245, 210, 190, ${alpha})`
        : `rgba(49, 20, 17, ${alpha * 0.8})`;
      ctx.beginPath();
      ctx.ellipse(x, y, radius * (0.7 + rng() * 1.2), radius * (0.4 + rng()), rng() * Math.PI, 0, Math.PI * 2);
      ctx.fill();

      const bumpShade = rng() > 0.45 ? 156 + rng() * 48 : 62 + rng() * 34;
      bump.fillStyle = `rgb(${bumpShade}, ${bumpShade}, ${bumpShade})`;
      bump.beginPath();
      bump.ellipse(x, y, radius * 0.9, radius * 0.55, rng() * Math.PI, 0, Math.PI * 2);
      bump.fill();
    }

    ctx.fillStyle = "rgba(255, 236, 218, 0.18)";
    ctx.fillRect(8, 8, 86, 9);
    ctx.fillStyle = "rgba(35, 13, 11, 0.2)";
    ctx.fillRect(28, 108, 86, 8);

    const bevel = ctx.createLinearGradient(0, 0, 0, 128);
    bevel.addColorStop(0, "rgba(255, 230, 210, 0.28)");
    bevel.addColorStop(0.18, "rgba(255, 230, 210, 0)");
    bevel.addColorStop(0.82, "rgba(30, 11, 9, 0)");
    bevel.addColorStop(1, "rgba(30, 11, 9, 0.34)");
    ctx.fillStyle = bevel;
    ctx.fillRect(0, 0, 128, 128);

    ctx.strokeStyle = "rgba(48, 18, 14, 0.94)";
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, 120, 120);
    ctx.strokeStyle = "rgba(255, 223, 198, 0.22)";
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, 112, 112);

    bump.fillStyle = "#969696";
    bump.fillRect(8, 8, 112, 112);
    bump.strokeStyle = "#303030";
    bump.lineWidth = 10;
    bump.strokeRect(5, 5, 118, 118);
    bump.strokeStyle = "#d0d0d0";
    bump.lineWidth = 3;
    bump.beginPath();
    bump.moveTo(10, 10);
    bump.lineTo(118, 10);
    bump.moveTo(10, 10);
    bump.lineTo(10, 118);
    bump.stroke();

    return { colorCanvas, bumpCanvas };
  }

  createBombCanvases() {
    const colorCanvas = document.createElement("canvas");
    const bumpCanvas = document.createElement("canvas");
    colorCanvas.width = 128;
    colorCanvas.height = 128;
    bumpCanvas.width = 128;
    bumpCanvas.height = 128;

    const ctx = colorCanvas.getContext("2d");
    const bump = bumpCanvas.getContext("2d");
    const body = ctx.createLinearGradient(0, 0, 128, 128);
    body.addColorStop(0, "#5a4a43");
    body.addColorStop(0.48, "#201d1c");
    body.addColorStop(1, "#090707");
    ctx.fillStyle = body;
    ctx.fillRect(0, 0, 128, 128);

    ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
    ctx.fillRect(12, 10, 62, 10);
    ctx.fillStyle = "rgba(255, 97, 42, 0.22)";
    ctx.fillRect(0, 0, 128, 128);

    ctx.strokeStyle = "rgba(255, 180, 88, 0.86)";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(64, 64, 34, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255, 90, 38, 0.78)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(64, 64, 43, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "#ffcf74";
    ctx.beginPath();
    ctx.moveTo(64, 28);
    ctx.lineTo(96, 86);
    ctx.lineTo(32, 86);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#241210";
    ctx.fillRect(60, 48, 8, 24);
    ctx.beginPath();
    ctx.arc(64, 79, 4.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(0, 0, 0, 0.82)";
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, 120, 120);
    ctx.strokeStyle = "rgba(255, 197, 102, 0.42)";
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, 108, 108);

    bump.fillStyle = "#6c6c6c";
    bump.fillRect(0, 0, 128, 128);
    bump.fillStyle = "#b8b8b8";
    bump.beginPath();
    bump.arc(64, 64, 35, 0, Math.PI * 2);
    bump.fill();
    bump.fillStyle = "#eeeeee";
    bump.fillRect(60, 48, 8, 24);
    bump.strokeStyle = "#242424";
    bump.lineWidth = 10;
    bump.strokeRect(5, 5, 118, 118);

    return { colorCanvas, bumpCanvas };
  }

  createGlowTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    const gradient = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
    gradient.addColorStop(0, "rgba(255, 210, 112, 1)");
    gradient.addColorStop(0.28, "rgba(255, 114, 42, 0.62)");
    gradient.addColorStop(1, "rgba(255, 80, 24, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  createBombBadgeTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, 128, 128);

    ctx.fillStyle = "rgba(18, 8, 6, 0.86)";
    ctx.beginPath();
    ctx.arc(64, 64, 50, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 193, 93, 0.95)";
    ctx.lineWidth = 8;
    ctx.stroke();

    ctx.fillStyle = "#ffc760";
    ctx.beginPath();
    ctx.moveTo(64, 27);
    ctx.lineTo(99, 89);
    ctx.lineTo(29, 89);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#241210";
    ctx.fillRect(59, 49, 10, 25);
    ctx.beginPath();
    ctx.arc(64, 82, 5, 0, Math.PI * 2);
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  resize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.renderer.setSize(width, height, false);
    this.viewportAspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  render(snapshot) {
    this.lastSnapshot = snapshot;
    if (!this.clearAnimation) {
      this.syncBlocks(snapshot);
    }
    this.syncBorders(snapshot);
    this.positionCamera(snapshot);
    this.renderer.render(this.scene, this.camera);
  }

  boardX(x, snapshot) {
    const offset = (MAX_WIDTH - snapshot.width) / 2;
    return offset + x - MAX_WIDTH / 2 + 0.5;
  }

  boardY(y, snapshot) {
    return snapshot.height / 2 - y - 0.5;
  }

  boardPosition(x, y, snapshot, zOffset = 0) {
    return new THREE.Vector3(this.boardX(x, snapshot), this.boardY(y, snapshot), zOffset);
  }

  syncBlocks(snapshot) {
    const desired = new Map();

    for (let y = 0; y < snapshot.height; y += 1) {
      for (let x = 0; x < snapshot.width; x += 1) {
        const cell = snapshot.grid[y][x];
        if (cell) desired.set(`grid:${x}:${y}`, { x, y, type: cell.type });
      }
    }

    if (snapshot.active) {
      for (const cell of cellsFor(snapshot.active)) {
        if (cell.y >= 0) {
          desired.set(`active:${cell.x}:${cell.y}`, {
            x: cell.x,
            y: cell.y,
            type: snapshot.active.type
          });
        }
      }
    }

    for (const [key, block] of this.blocks) {
      if (!desired.has(key)) {
        this.boardGroup.remove(block);
        this.blocks.delete(key);
      }
    }

    for (const [key, cell] of desired) {
      let block = this.blocks.get(key);
      if (block && block.userData.type !== cell.type) {
        this.boardGroup.remove(block);
        this.blocks.delete(key);
        block = null;
      }
      if (!block) {
        block = this.createBlock(cell.type);
        block.userData.type = cell.type;
        this.boardGroup.add(block);
        this.blocks.set(key, block);
      }
      block.visible = true;
      block.userData.grid = { x: cell.x, y: cell.y };
      const basePosition = this.boardPosition(cell.x, cell.y, snapshot, key.startsWith("active") ? 0.14 : 0);
      block.userData.basePosition = basePosition;
      block.position.copy(basePosition);
      block.rotation.set(0, 0, 0);
      block.scale.setScalar(1);
      this.updateBombPulse(block);
    }
  }

  createBlock(type) {
    const group = new THREE.Group();

    const shadow = new THREE.Mesh(this.shadowGeometry, this.shadowMaterial);
    shadow.position.set(0.12, -0.14, -0.045);
    group.add(shadow);

    const cube = new THREE.Mesh(this.blockGeometry, this.getMaterial(type));
    cube.position.z = 0;
    group.add(cube);

    const edges = new THREE.LineSegments(this.edgeGeometry, this.edgeMaterial);
    edges.position.z = 0.003;
    group.add(edges);

    if (type === "bomb") {
      const halo = new THREE.Mesh(
        new THREE.PlaneGeometry(1.55, 1.55),
        this.bombHaloMaterial.clone()
      );
      halo.position.set(0, 0, BLOCK_DEPTH + 0.08);
      halo.userData.isBombHalo = true;
      group.add(halo);

      const badge = new THREE.Mesh(
        new THREE.PlaneGeometry(0.64, 0.64),
        this.bombBadgeMaterial.clone()
      );
      badge.position.set(0, 0, BLOCK_DEPTH + 0.22);
      badge.userData.isBombBadge = true;
      group.add(badge);

      const fuse = new THREE.Mesh(
        new THREE.SphereGeometry(0.13, 14, 10),
        new THREE.MeshBasicMaterial({ color: 0xffc05a })
      );
      fuse.position.set(0.2, -0.18, BLOCK_DEPTH + 0.2);
      fuse.userData.isBombFuse = true;
      group.add(fuse);
    }

    return group;
  }

  syncBorders(snapshot) {
    const borderKey = `${snapshot.width}:${snapshot.height}`;
    if (this.borderKey === borderKey) return;
    this.borderKey = borderKey;

    for (const object of this.borderObjects) {
      this.boardGroup.remove(object);
      object.geometry?.dispose();
    }
    this.borderObjects = [];

    const offset = (MAX_WIDTH - snapshot.width) / 2;
    const leftEdge = offset - MAX_WIDTH / 2;
    const rightEdge = offset + snapshot.width - MAX_WIDTH / 2;
    const centerY = 0;
    const height = snapshot.height;

    const leftZoneWidth = Math.max(0, offset);
    const rightZoneWidth = Math.max(0, MAX_WIDTH - snapshot.width - offset);
    if (leftZoneWidth > 0) {
      this.addInactiveZone(-MAX_WIDTH / 2 + leftZoneWidth / 2, centerY, leftZoneWidth, height);
    }
    if (rightZoneWidth > 0) {
      this.addInactiveZone(MAX_WIDTH / 2 - rightZoneWidth / 2, centerY, rightZoneWidth, height);
    }

    this.addWall(leftEdge - 0.11, centerY, 0.22, height + 0.35);
    this.addWall(rightEdge + 0.11, centerY, 0.22, height + 0.35);
    this.addWall(0, -snapshot.height / 2 - 0.12, snapshot.width + 0.44, 0.24);
  }

  addWall(x, y, width, height) {
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, 0.5),
      this.borderMaterial
    );
    wall.position.set(x, y, 0.08);
    this.boardGroup.add(wall);
    this.borderObjects.push(wall);
  }

  addInactiveZone(x, y, width, height) {
    const zone = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      this.inactiveMaterial
    );
    zone.position.set(x, y, -0.035);
    this.boardGroup.add(zone);
    this.borderObjects.push(zone);
  }

  positionCamera(snapshot) {
    const aspect = this.viewportAspect ?? 1;
    const boardWidth = MAX_WIDTH + 0.5;
    const boardHeight = snapshot.height + 0.5;
    const viewHeight = Math.max(boardHeight, boardWidth / Math.max(0.1, aspect));
    const viewWidth = viewHeight * aspect;
    this.camera.left = -viewWidth / 2;
    this.camera.right = viewWidth / 2;
    this.camera.top = viewHeight / 2;
    this.camera.bottom = -viewHeight / 2;
    this.camera.updateProjectionMatrix();
    this.camera.position.set(0, -6.4, 38);
    this.camera.lookAt(0, 0, 0);
    this.backgroundPlane.scale.setScalar(Math.max(1, viewHeight / 20));
  }

  animateClear(rows, onDone, snapshot = this.lastSnapshot, onBomb) {
    if (!snapshot) {
      onDone();
      return;
    }
    this.syncBlocks(snapshot);
    this.syncBorders(snapshot);
    this.lastSnapshot = snapshot;
    this.clearAnimation = {
      rows: new Set(rows),
      bombs: snapshot.lastClear?.bombs ?? [],
      onDone,
      onBomb,
      start: performance.now(),
      duration: 62 * snapshot.width + 520,
      touched: new Set(),
      detonatedBombs: new Set()
    };
    this.clearParticles();
    this.clearBombBursts();
  }

  updateAnimations(now = performance.now()) {
    if (!this.clearAnimation || !this.lastSnapshot) return;

    const { rows, bombs, start, duration, onDone, onBomb, touched, detonatedBombs } = this.clearAnimation;
    const elapsed = now - start;
    const columnDelay = 62;
    const maxColumn = Math.floor(elapsed / columnDelay);

    for (const block of this.blocks.values()) {
      const grid = block.userData.grid;
      if (!grid || !rows.has(grid.y) || grid.x > maxColumn) continue;
      const key = `${grid.x}:${grid.y}`;
      if (!touched.has(key)) {
        touched.add(key);
        this.spawnDust(block, grid);
      }
      const local = Math.max(0, elapsed - grid.x * columnDelay);
      const t = easeOutCubic(Math.min(1, local / 440));
      const base = block.userData.basePosition;
      block.position.set(
        base.x + t * (0.18 + grid.x * 0.015) + Math.sin(t * Math.PI * 3 + grid.y) * 0.08,
        base.y + Math.sin(t * Math.PI) * 0.22,
        base.z + 0.15 + t * 2.1
      );
      block.rotation.z = t * Math.PI * (0.6 + grid.x * 0.05);
      block.rotation.x = t * Math.PI * 0.32;
      const squash = Math.max(0.02, 1 - easeInCubic(Math.max(0, (local - 130) / 310)));
      block.scale.set(squash, squash, Math.max(0.02, squash * 0.85));
      block.visible = squash > 0.04;
    }

    for (const bomb of bombs) {
      const key = `${bomb.x}:${bomb.y}`;
      if (bomb.x <= maxColumn && rows.has(bomb.y) && !detonatedBombs.has(key)) {
        detonatedBombs.add(key);
        this.spawnBombBurst(bomb, this.lastSnapshot);
        onBomb?.(bomb);
      }
    }

    this.updateDust(now);
    this.updateBombBursts(now);

    if (elapsed >= duration) {
      this.clearAnimation = null;
      this.clearParticles();
      this.clearBombBursts();
      onDone();
    }
  }

  updateBombPulse(block) {
    if (block.children.length === 0) return;
    const pulse = 0.5 + Math.sin(performance.now() * 0.006) * 0.5;
    for (const child of block.children) {
      if (child.userData.isBombHalo) {
        child.material.opacity = 0.24 + pulse * 0.42;
        const scale = 0.9 + pulse * 0.14;
        child.scale.set(scale, scale, 1);
      } else if (child.userData.isBombBadge) {
        const scale = 0.95 + pulse * 0.05;
        child.scale.set(scale, scale, 1);
      } else if (child.userData.isBombFuse) {
        child.scale.setScalar(0.86 + pulse * 0.3);
      }
    }
  }

  spawnDust(block, grid) {
    const base = block.userData.basePosition;
    for (let i = 0; i < 5; i += 1) {
      const particle = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.12, 0.12),
        this.particleMaterial.clone()
      );
      const angle = -0.8 + i * 0.34;
      const speed = 0.8 + i * 0.08;
      particle.position.set(base.x, base.y, base.z + 0.54);
      particle.userData.velocity = new THREE.Vector3(
        Math.cos(angle) * speed,
        Math.sin(angle) * 0.35,
        0.8 + i * 0.1
      );
      particle.userData.start = performance.now();
      particle.userData.life = 420 + grid.x * 8;
      this.boardGroup.add(particle);
      this.particles.push(particle);
    }
  }

  updateDust(now) {
    for (const particle of this.particles) {
      const age = now - particle.userData.start;
      const t = Math.min(1, age / particle.userData.life);
      const velocity = particle.userData.velocity;
      particle.position.x += velocity.x * 0.018;
      particle.position.y += velocity.y * 0.018;
      particle.position.z += velocity.z * 0.018 - t * 0.035;
      particle.rotation.z += 0.12;
      particle.scale.setScalar(Math.max(0.01, 1 - t));
      particle.material.opacity = Math.max(0, 0.72 * (1 - t));
    }
  }

  clearParticles() {
    for (const particle of this.particles) {
      this.boardGroup.remove(particle);
      particle.geometry.dispose();
      particle.material.dispose();
    }
    this.particles = [];
  }

  spawnBombBurst(bomb, snapshot) {
    const center = this.boardPosition(bomb.x, bomb.y, snapshot, 1.15);

    for (let i = 0; i < 26; i += 1) {
      const angle = (i / 26) * Math.PI * 2;
      const particle = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.16, 0.16),
        new THREE.MeshBasicMaterial({
          color: i % 3 === 0 ? 0xffd27a : 0xd94d35,
          transparent: true,
          opacity: 0.92,
          depthWrite: false
        })
      );
      particle.position.copy(center);
      particle.userData.start = performance.now();
      particle.userData.life = 620;
      particle.userData.velocity = new THREE.Vector3(
        Math.cos(angle) * (0.1 + (i % 5) * 0.012),
        Math.sin(angle) * (0.1 + (i % 4) * 0.012),
        0.06 + (i % 6) * 0.014
      );
      this.boardGroup.add(particle);
      this.bombBursts.push(particle);
    }
  }

  updateBombBursts(now) {
    for (const particle of this.bombBursts) {
      const age = now - particle.userData.start;
      const t = Math.min(1, age / particle.userData.life);
      const velocity = particle.userData.velocity;
      particle.position.x += velocity.x;
      particle.position.y += velocity.y;
      particle.position.z += velocity.z - t * 0.055;
      particle.rotation.x += 0.18;
      particle.rotation.z += 0.15;
      particle.scale.setScalar(Math.max(0.01, 1 - t * 0.9));
      particle.material.opacity = Math.max(0, 0.92 * (1 - t));
    }
  }

  clearBombBursts() {
    for (const particle of this.bombBursts) {
      this.boardGroup.remove(particle);
      particle.geometry.dispose();
      particle.material.dispose();
    }
    this.bombBursts = [];
  }

  dispose() {
    this.renderer.dispose();
    this.blockGeometry.dispose();
    this.edgeGeometry.dispose();
    this.shadowGeometry.dispose();
    this.shadowMaterial.dispose();
    this.edgeMaterial.dispose();
    this.borderMaterial.dispose();
    this.inactiveMaterial.dispose();
    this.particleMaterial.dispose();
    this.bombHaloMaterial.map?.dispose();
    this.bombHaloMaterial.dispose();
    this.bombBadgeMaterial.map?.dispose();
    this.bombBadgeMaterial.dispose();
    this.clearBombBursts();
    for (const material of this.materials.values()) {
      material.map?.dispose();
      material.dispose();
    }
  }
}

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

function easeInCubic(t) {
  return t ** 3;
}
