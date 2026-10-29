/* =========================================================
   render-3d-actors.js · Personajes 3D Estilizados AAA (Lali y Oli)
   Modelos PBR estilizados (Toy-Like / Chibi), animación procedural de paso,
   rebote rítmico (Squash & Stretch) y sombras proyectadas.
   ========================================================= */
import * as THREE from './lib/three.module.js';

// ---------- Paleta de Materiales para Personajes ----------
const ACTOR_MAT = {
  skinLali: new THREE.MeshStandardMaterial({ color: 0xf2be9b, roughness: 0.6, metalness: 0.0 }),
  skinOli:  new THREE.MeshStandardMaterial({ color: 0xdeb08a, roughness: 0.6, metalness: 0.0 }),
  hairLali: new THREE.MeshStandardMaterial({ color: 0x4a2c1d, roughness: 0.55, metalness: 0.05 }),
  hairOli:  new THREE.MeshStandardMaterial({ color: 0x221814, roughness: 0.55, metalness: 0.05 }),
  eyes:     new THREE.MeshBasicMaterial({ color: 0x1a120e }),
  eyeGlint: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  blush:    new THREE.MeshBasicMaterial({ color: 0xee7d72, transparent: true, opacity: 0.55 }),
  shirtLali:new THREE.MeshStandardMaterial({ color: 0x0f8b8d, roughness: 0.45, metalness: 0.05 }), // Azul Charco
  shirtOli: new THREE.MeshStandardMaterial({ color: 0xe8603c, roughness: 0.45, metalness: 0.05 }), // Coral Canario
  apron:    new THREE.MeshStandardMaterial({ color: 0x3d4a5d, roughness: 0.7, metalness: 0.05 }),  // Denim oscuro
  apronLali:new THREE.MeshStandardMaterial({ color: 0xfdfaf2, roughness: 0.8, metalness: 0.02 }),  // Lino crudo
  pants:    new THREE.MeshStandardMaterial({ color: 0x243242, roughness: 0.6, metalness: 0.02 }),
  shortsOli:new THREE.MeshStandardMaterial({ color: 0xc4b28c, roughness: 0.65, metalness: 0.02 }), // Khaki
  shoes:    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.05 }),
  shoeSole: new THREE.MeshStandardMaterial({ color: 0x6e4325, roughness: 0.8 }),
  bandana:  new THREE.MeshStandardMaterial({ color: 0xf5b82e, roughness: 0.5, metalness: 0.1 }),   // Oro
  capOli:   new THREE.MeshStandardMaterial({ color: 0x0f8b8d, roughness: 0.45, metalness: 0.05 }),  // Teal
  shadow:   new THREE.MeshBasicMaterial({ color: 0x081f21, transparent: true, opacity: 0.32 })
};

// ---------- Constructor del Modelo 3D de un Personaje ----------
export function createCharacter3D(type = 'lali') {
  const char = new THREE.Group();
  char.name = type;

  const isLali = type === 'lali';
  const skinMat = isLali ? ACTOR_MAT.skinLali : ACTOR_MAT.skinOli;
  const hairMat = isLali ? ACTOR_MAT.hairLali : ACTOR_MAT.hairOli;
  const shirtMat = isLali ? ACTOR_MAT.shirtLali : ACTOR_MAT.shirtOli;
  const apronMat = isLali ? ACTOR_MAT.apronLali : ACTOR_MAT.apron;

  // 1. Sombra suave de contacto en el suelo
  const shadowGeo = new THREE.PlaneGeometry(0.9, 0.9);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMesh = new THREE.Mesh(shadowGeo, ACTOR_MAT.shadow);
  shadowMesh.position.y = 0.02;
  char.add(shadowMesh);

  // Caderas: pivote común de torso y piernas (pies anclados en y=0 del personaje)
  const hips = new THREE.Group();
  hips.position.y = 0.56;
  char.add(hips);

  const BODY_BASE_Y = 0.10;
  const bodyRoot = new THREE.Group();
  bodyRoot.position.y = BODY_BASE_Y;
  hips.add(bodyRoot);

  // 2. Torso (Cuerpo y delantal)
  const torsoGeo = new THREE.CylinderGeometry(0.24, 0.28, 0.55, 12);
  const torso = new THREE.Mesh(torsoGeo, shirtMat);
  torso.castShadow = true;
  torso.receiveShadow = true;
  torso.position.y = 0.28;
  bodyRoot.add(torso);

  // Delantal sobre el torso
  const apronGeo = new THREE.CylinderGeometry(0.22, 0.25, 0.30, 12, 1, false, 0, Math.PI * 1.15);
  apronGeo.rotateY(Math.PI * 0.75);
  const apron = new THREE.Mesh(apronGeo, apronMat);
  apron.position.y = 0.20;
  apron.castShadow = true;
  bodyRoot.add(apron);

  // Bolsillo delantero del delantal
  const pocketGeo = new THREE.BoxGeometry(0.22, 0.14, 0.04);
  const pocket = new THREE.Mesh(pocketGeo, isLali ? ACTOR_MAT.woodTeak : ACTOR_MAT.coral);
  pocket.position.set(0, 0.20, 0.27);
  bodyRoot.add(pocket);

  // Cuello
  const neckGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.12, 10);
  const neck = new THREE.Mesh(neckGeo, skinMat);
  neck.position.y = 0.58;
  bodyRoot.add(neck);

  // 3. Cabeza Estilizada
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.92, 0);
  bodyRoot.add(headGroup);

  const headGeo = new THREE.SphereGeometry(0.35, 18, 14);
  headGeo.scale(1.0, 1.05, 0.96);
  const head = new THREE.Mesh(headGeo, skinMat);
  head.castShadow = true;
  headGroup.add(head);

  // Ojos grandes estilizados (estilo anime / chibi)
  [-0.14, 0.14].forEach(x => {
    // Ojo oscuro
    const eyeGeo = new THREE.SphereGeometry(0.065, 10, 8);
    eyeGeo.scale(0.85, 1.25, 0.4);
    const eye = new THREE.Mesh(eyeGeo, ACTOR_MAT.eyes);
    eye.position.set(x, 0.02, 0.33);
    headGroup.add(eye);

    // Brillo blanco en los ojos (dopamina visual)
    const glintGeo = new THREE.SphereGeometry(0.025, 8, 6);
    const glint = new THREE.Mesh(glintGeo, ACTOR_MAT.eyeGlint);
    glint.position.set(x + 0.02, 0.045, 0.35);
    headGroup.add(glint);

    // Rubor en las mejillas
    const blushGeo = new THREE.SphereGeometry(0.055, 8, 6);
    blushGeo.scale(1.2, 0.5, 0.3);
    const blush = new THREE.Mesh(blushGeo, ACTOR_MAT.blush);
    blush.position.set(x * 1.35, -0.06, 0.31);
    headGroup.add(blush);
  });

  // Nariz pequeña redonda
  const noseGeo = new THREE.SphereGeometry(0.038, 8, 6);
  const nose = new THREE.Mesh(noseGeo, skinMat);
  nose.position.set(0, -0.02, 0.36);
  headGroup.add(nose);

  // Pelo y Accesorios Únicos
  if (isLali) {
    // LALI: Melena con ondas y moño desenfadado de barista
    const hairTopGeo = new THREE.SphereGeometry(0.38, 16, 12);
    hairTopGeo.scale(1.03, 1.05, 1.04);
    const hairTop = new THREE.Mesh(hairTopGeo, hairMat);
    hairTop.position.set(0, 0.06, -0.04);
    hairTop.castShadow = true;
    headGroup.add(hairTop);

    // Moño alto
    const bunGeo = new THREE.SphereGeometry(0.18, 12, 10);
    const bun = new THREE.Mesh(bunGeo, hairMat);
    bun.position.set(0, 0.38, -0.16);
    bun.castShadow = true;
    headGroup.add(bun);

    // Pañuelo / Cinta bandana dorada canaria
    const bandGeo = new THREE.TorusGeometry(0.36, 0.04, 8, 20);
    bandGeo.rotateX(Math.PI / 2.3);
    const band = new THREE.Mesh(bandGeo, ACTOR_MAT.bandana);
    band.position.set(0, 0.12, 0.02);
    headGroup.add(band);

    // Mechones laterales
    [-0.32, 0.32].forEach(x => {
      const strandGeo = new THREE.ConeGeometry(0.08, 0.35, 6);
      strandGeo.rotateZ(x > 0 ? -0.2 : 0.2);
      const strand = new THREE.Mesh(strandGeo, hairMat);
      strand.position.set(x, -0.12, 0.15);
      headGroup.add(strand);
    });
  } else {
    // OLI: Pelo corto texturizado con visera/gorra playera
    const hairGeo = new THREE.SphereGeometry(0.37, 16, 12);
    hairGeo.scale(1.02, 1.03, 1.03);
    const hair = new THREE.Mesh(hairGeo, hairMat);
    hair.position.set(0, 0.07, -0.02);
    hair.castShadow = true;
    headGroup.add(hair);

    // Gorra playera moderna
    const capGeo = new THREE.SphereGeometry(0.38, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    const cap = new THREE.Mesh(capGeo, ACTOR_MAT.capOli);
    cap.position.set(0, 0.1, -0.02);
    headGroup.add(cap);

    // Visera de la gorra hacia atrás o lateral
    const visorGeo = new THREE.BoxGeometry(0.36, 0.04, 0.22);
    visorGeo.rotateY(0.2);
    const visor = new THREE.Mesh(visorGeo, ACTOR_MAT.capOli);
    visor.position.set(0.08, 0.18, -0.36);
    headGroup.add(visor);
  }

  // 4. Brazos Articulados (Pivote en los hombros)
  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-0.32, 0.46, 0);
  bodyRoot.add(leftArmPivot);

  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(0.32, 0.46, 0);
  bodyRoot.add(rightArmPivot);

  [leftArmPivot, rightArmPivot].forEach((pivot, idx) => {
    // Manga de la camiseta
    const sleeveGeo = new THREE.CylinderGeometry(0.09, 0.10, 0.14, 8);
    const sleeve = new THREE.Mesh(sleeveGeo, shirtMat);
    sleeve.position.y = -0.07;
    pivot.add(sleeve);

    // Brazo de piel
    const armGeo = new THREE.CylinderGeometry(0.075, 0.07, 0.32, 8);
    const arm = new THREE.Mesh(armGeo, skinMat);
    arm.position.y = -0.26;
    pivot.add(arm);

    // Mano estilización mitón
    const handGeo = new THREE.SphereGeometry(0.085, 8, 8);
    const hand = new THREE.Mesh(handGeo, skinMat);
    hand.position.y = -0.44;
    pivot.add(hand);
  });

  // 5. Piernas Articuladas (Pivote en la cadera)
  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(-0.14, 0, 0);
  hips.add(leftLegPivot);

  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(0.14, 0, 0);
  hips.add(rightLegPivot);

  [leftLegPivot, rightLegPivot].forEach(pivot => {
    // Pantalón / Pantalón corto
    const pantsGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.28, 8);
    const pants = new THREE.Mesh(pantsGeo, isLali ? ACTOR_MAT.pants : ACTOR_MAT.shortsOli);
    pants.position.y = -0.14;
    pivot.add(pants);

    // Pierna visible
    const legGeo = new THREE.CylinderGeometry(0.08, 0.075, 0.22, 8);
    const leg = new THREE.Mesh(legGeo, skinMat);
    leg.position.y = -0.32;
    pivot.add(leg);

    // Zapatilla de lona estilizada
    const shoeGeo = new THREE.BoxGeometry(0.18, 0.12, 0.28);
    const shoe = new THREE.Mesh(shoeGeo, ACTOR_MAT.shoes);
    shoe.position.set(0, -0.45, 0.05);
    shoe.castShadow = true;
    pivot.add(shoe);

    // Suela marrón
    const soleGeo = new THREE.BoxGeometry(0.19, 0.03, 0.29);
    const sole = new THREE.Mesh(soleGeo, ACTOR_MAT.shoeSole);
    sole.position.set(0, -0.51, 0.05);
    sole.castShadow = true;
    pivot.add(sole);
  });

  // Estructura interna de animación
  char.userData = {
    type,
    baseY: 0,
    bodyBaseY: BODY_BASE_Y,
    hips,
    walkPhase: 0,
    speed: 0,
    targetAngle: 0,
    currentAngle: 0,
    bodyRoot,
    headGroup,
    leftArm: leftArmPivot,
    rightArm: rightArmPivot,
    leftLeg: leftLegPivot,
    rightLeg: rightLegPivot,
    shadow: shadowMesh
  };

  return char;
}

// ---------- Sistema de Animación Procedural (Squash & Stretch) ----------
export function animateCharacter(char, vx, vz, dt = 0.016) {
  if (!char || !char.userData) return;
  const ud = char.userData;

  const speed = Math.hypot(vx, vz);
  ud.speed = THREE.MathUtils.lerp(ud.speed, speed, 0.2);

  // 1. Orientación del personaje hacia el movimiento
  if (speed > 0.05) {
    ud.targetAngle = Math.atan2(vx, vz);
  }

  // Interpolación de ángulo suave (evitando giros de 360)
  let diff = ud.targetAngle - ud.currentAngle;
  while (diff < -Math.PI) diff += Math.PI * 2;
  while (diff > Math.PI) diff -= Math.PI * 2;
  ud.currentAngle += diff * 0.22;
  char.rotation.y = ud.currentAngle;

  const time = performance.now() * 0.001;

  const bodyY = ud.bodyBaseY ?? 0.10;

  if (ud.speed > 0.1) {
    // MODO CAMINAR: rebote suave (sin²) y zancada moderada
    ud.walkPhase += dt * ud.speed * 5.5;

    const sinBob = Math.sin(ud.walkPhase);
    const bob = sinBob * sinBob * 0.045;
    ud.bodyRoot.position.y = bodyY + bob;

    ud.bodyRoot.rotation.x = 0.06;
    ud.bodyRoot.rotation.z = Math.sin(ud.walkPhase) * 0.025;

    // C) Oscilación de brazos (o sostener bandeja si lleva pedidos)
    const hasTray = ud.trayGroup && ud.trayGroup.visible && ud.trayGroup.userData.items && ud.trayGroup.userData.items.length > 0;
    if (hasTray) {
      ud.leftArm.rotation.x = -0.72 + Math.sin(ud.walkPhase) * 0.04;
      ud.leftArm.rotation.y = 0.22;
      ud.leftArm.rotation.z = -0.10;
      ud.rightArm.rotation.x = -0.72 - Math.sin(ud.walkPhase) * 0.04;
      ud.rightArm.rotation.y = -0.22;
      ud.rightArm.rotation.z = 0.10;
      ud.trayGroup.rotation.z = -Math.sin(ud.walkPhase) * 0.018;
      ud.trayGroup.position.y = 0.28 + bob * 0.25;
    } else {
      const armSwing = Math.sin(ud.walkPhase) * 0.42;
      ud.leftArm.rotation.x = armSwing;
      ud.leftArm.rotation.y = 0;
      ud.leftArm.rotation.z = 0;
      ud.rightArm.rotation.x = -armSwing;
      ud.rightArm.rotation.y = 0;
      ud.rightArm.rotation.z = 0;
    }

    // D) Zancada de piernas alternada
    const legSwing = Math.sin(ud.walkPhase) * 0.44;
    ud.leftLeg.rotation.x = -legSwing;
    ud.rightLeg.rotation.x = legSwing;

    // E) Cabeza con contrapeso suave
    ud.headGroup.rotation.x = -0.08 + Math.cos(ud.walkPhase * 2) * 0.03;
    ud.headGroup.rotation.z = -Math.sin(ud.walkPhase) * 0.05;

    // F) Sombra que se encoge ligeramente al elevarse el personaje
    ud.shadow.scale.set(1.0 - bob * 0.8, 1.0 - bob * 0.8, 1.0);
  } else {
    // MODO IDLE: Respiración rítmica y postura relajada
    const breath = Math.sin(time * 2.8) * 0.02;
    ud.bodyRoot.position.y = bodyY + breath;
    ud.bodyRoot.rotation.x = 0;
    ud.bodyRoot.rotation.z = 0;

    // Brazos relajados (o sosteniendo bandeja en reposo)
    const hasTray = ud.trayGroup && ud.trayGroup.visible && ud.trayGroup.userData.items && ud.trayGroup.userData.items.length > 0;
    if (hasTray) {
      ud.leftArm.rotation.x = -0.70;
      ud.leftArm.rotation.y = 0.22;
      ud.leftArm.rotation.z = -0.10;
      ud.rightArm.rotation.x = -0.70;
      ud.rightArm.rotation.y = -0.22;
      ud.rightArm.rotation.z = 0.10;
      ud.trayGroup.rotation.z = 0;
      ud.trayGroup.position.y = 0.28 + breath * 0.3;
    } else {
      ud.leftArm.rotation.x = THREE.MathUtils.lerp(ud.leftArm.rotation.x, 0.05, 0.1);
      ud.leftArm.rotation.y = THREE.MathUtils.lerp(ud.leftArm.rotation.y, 0, 0.1);
      ud.leftArm.rotation.z = THREE.MathUtils.lerp(ud.leftArm.rotation.z, 0, 0.1);
      ud.rightArm.rotation.x = THREE.MathUtils.lerp(ud.rightArm.rotation.x, 0.05, 0.1);
      ud.rightArm.rotation.y = THREE.MathUtils.lerp(ud.rightArm.rotation.y, 0, 0.1);
      ud.rightArm.rotation.z = THREE.MathUtils.lerp(ud.rightArm.rotation.z, 0, 0.1);
    }

    // Piernas rectas
    ud.leftLeg.rotation.x = THREE.MathUtils.lerp(ud.leftLeg.rotation.x, 0, 0.1);
    ud.rightLeg.rotation.x = THREE.MathUtils.lerp(ud.rightLeg.rotation.x, 0, 0.1);

    // Cabeza con mirada vivaz
    ud.headGroup.rotation.x = THREE.MathUtils.lerp(ud.headGroup.rotation.x, 0, 0.1);
    ud.headGroup.rotation.z = Math.sin(time * 1.4) * 0.03;

    ud.shadow.scale.set(1.0, 1.0, 1.0);
  }
}
