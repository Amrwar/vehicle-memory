'use client';

import { msg } from '@carnet/core';
import * as React from 'react';
import * as THREE from 'three';

/**
 * The claim, in three dimensions, with the car in the middle of it.
 *
 * A diagram of a service history is a diagram. This is the vehicle itself,
 * turning, with the record attached to the parts it was written about: tap the
 * front wheel and you get the tyre reading from 2023, tap the bonnet and you
 * get the service. That is the entire product argument made physical, and it
 * is the one thing on this page a competitor cannot screenshot and copy,
 * because they do not have a record that belongs to the car.
 *
 * Built from geometry rather than a downloaded model. A licensed vehicle mesh
 * is a megabyte or two, a legal question and a request to somebody else's
 * server; primitives cost nothing, load instantly and can be lit properly.
 *
 * Three rules, none of them negotiable:
 *
 * It degrades. No WebGL, or a browser that refuses the context, and the caller
 * shows the flat diagram instead. Nobody meets an empty rectangle.
 *
 * It respects a person who has asked for less movement. Reduced motion stops
 * the idle rotation entirely; the scene stays, and dragging still works,
 * because a thing that only moves when you move it is not what makes people
 * ill.
 *
 * It is not the only way to read the content. Every hotspot is also a real
 * button in the DOM, focusable and labelled, and the panel beside the canvas
 * is ordinary text. Somebody using a keyboard and a screen reader gets the
 * whole story without a single pixel of the canvas.
 */

export interface PassportEvent {
  id: string;
  /** Where on the vehicle it happened, in scene units. */
  at: [number, number, number];
  year: string;
  title: string;
  detail: string;
  workshop: string;
  tone: 'record' | 'advisory' | 'alert';
}

/** The demonstration vehicle's own history, and the rollback it carries. */
export const DEMO_EVENTS: PassportEvent[] = [
  {
    id: 'service',
    at: [1.12, 0.74, 0.0], // the bonnet
    year: '2022',
    title: msg('Full service, 58,940 miles'),
    detail: msg(
      'Oil, filters and a 30-point inspection. Written to the chain the moment the job closed, and readable by every workshop the car visits afterwards.',
    ),
    workshop: 'Kirkstall Autocentre',
    tone: 'record',
  },
  {
    id: 'tyres',
    at: [0.92, 0.3, 0.86], // nearside front wheel
    year: '2023',
    title: msg('Nearside front tyre at 2.4mm'),
    detail: msg(
      'Recorded as an advisory rather than sold as urgent. The next garage sees the measurement, not somebody else’s opinion of it.',
    ),
    workshop: 'Kirkstall Autocentre',
    tone: 'advisory',
  },
  {
    id: 'brakes',
    at: [-0.92, 0.3, 0.86], // nearside rear wheel
    year: msg('Mar 2024'),
    title: msg('Rear pads replaced'),
    detail: msg(
      'Quoted from an inspection, approved by the customer line by line from a text message, and fitted the same afternoon.',
    ),
    workshop: 'Hillside Motors',
    tone: 'record',
  },
  {
    id: 'odometer',
    at: [-0.4, 1.19, 0.0], // just above the roof
    year: msg('Sep 2024'),
    title: msg('The odometer went backwards'),
    detail: msg(
      'It read 67,410 in April and 62,000 in September. Every reading since has been consistent, so a garage comparing its own last two sees nothing wrong. Only the whole sequence shows it.',
    ),
    workshop: msg('Recorded between owners'),
    tone: 'alert',
  },
];

const PALETTE = {
  body: 0x1a4d52,
  bodyDark: 0x123236,
  glass: 0x9fc4c7,
  tyre: 0x14181a,
  rim: 0xb0d4d6,
  brass: 0xb8863b,
  alert: 0xc44a4a,
  amber: 0xc99745,
};

/**
 * A car, extruded from its own side profile.
 *
 * The first attempt stacked boxes, and boxes make a pickup: a slab for the
 * body, a smaller slab for the cabin, and the flat deck left between them
 * behind the roof reads as a load bed however it is lit. A silhouette is what
 * makes a car a car, so this draws one and extrudes it across the width.
 *
 * Metalness is kept low deliberately. A metallic surface with no environment
 * map has nothing to reflect, so it renders almost black and takes its whole
 * colour from whatever light happens to graze it, which is how a petrol-green
 * car came out gold.
 */
function buildVehicle(): THREE.Group {
  const car = new THREE.Group();

  const paint = new THREE.MeshStandardMaterial({
    color: PALETTE.body,
    metalness: 0.2,
    roughness: 0.45,
  });

  const trim = new THREE.MeshStandardMaterial({
    color: PALETTE.bodyDark,
    metalness: 0.15,
    roughness: 0.6,
  });

  const glass = new THREE.MeshStandardMaterial({
    color: PALETTE.glass,
    metalness: 0.05,
    roughness: 0.12,
    transparent: true,
    opacity: 0.45,
  });

  /* --- the silhouette --------------------------------------------------- */

  // Read as a side elevation: nose on the right, tail on the left. The two
  // arches are cut out so the wheels sit in the body rather than beside it.
  const profile = new THREE.Shape();

  profile.moveTo(1.48, 0.2);
  profile.lineTo(1.52, 0.44);
  profile.lineTo(1.44, 0.6); // bonnet leading edge
  profile.lineTo(0.62, 0.68); // scuttle
  profile.quadraticCurveTo(0.34, 0.72, 0.12, 1.06); // windscreen
  profile.lineTo(-0.62, 1.1); // roof
  profile.quadraticCurveTo(-0.98, 1.08, -1.16, 0.78); // rear screen
  profile.lineTo(-1.44, 0.7); // boot lid
  profile.lineTo(-1.52, 0.44);
  profile.lineTo(-1.48, 0.2);
  profile.lineTo(1.48, 0.2);

  const body = new THREE.Mesh(
    new THREE.ExtrudeGeometry(profile, {
      depth: 1.36,
      bevelEnabled: true,
      bevelThickness: 0.05,
      bevelSize: 0.05,
      bevelSegments: 3,
      curveSegments: 14,
    }),
    paint,
  );

  // Extrusion runs along +z from the drawing plane, so it has to be pushed
  // back by half its depth to sit centred on the turntable.
  body.rotation.y = 0;
  body.position.z = -0.68;
  body.castShadow = true;
  car.add(body);

  /* --- glazing ----------------------------------------------------------- */

  // Let into each flank rather than standing beside it. The body's own
  // profile already carries the greenhouse shape, so a pane is all that is
  // wanted; the earlier version added planes larger than the cabin and they
  // floated clear of the car from every angle.
  for (const side of [0.681, -0.681]) {
    const pane = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.26, 0.01), glass);
    pane.position.set(-0.3, 0.9, side);
    car.add(pane);
  }

  // No separate windscreen. The profile's own rake is the windscreen, and a
  // pane laid over it read as a white streak across the roof.

  /* --- the details that say which end is which --------------------------- */

  const grille = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.78), trim);
  grille.position.set(1.5, 0.46, 0);
  car.add(grille);

  for (const [x, colour, intensity] of [
    [1.5, 0xfff2d8, 1.5],
    [-1.5, 0xc44a4a, 0.9],
  ] as const) {
    for (const z of [0.44, -0.44]) {
      const lamp = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.11, 0.26),
        new THREE.MeshStandardMaterial({
          color: colour,
          emissive: colour,
          emissiveIntensity: intensity,
        }),
      );
      lamp.position.set(x, 0.58, z);
      car.add(lamp);
    }
  }

  // A waist line down each flank, which is what stops a single extrusion
  // reading as a solid block of colour.
  for (const side of [0.7, -0.7]) {
    const crease = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.04, 0.02), trim);
    crease.position.set(0, 0.5, side);
    car.add(crease);
  }

  /* --- wheels ------------------------------------------------------------ */

  const tyre = new THREE.MeshStandardMaterial({
    color: PALETTE.tyre,
    roughness: 0.9,
    metalness: 0.02,
  });

  const rim = new THREE.MeshStandardMaterial({
    color: PALETTE.rim,
    metalness: 0.7,
    roughness: 0.3,
  });

  const wheels: THREE.Group[] = [];

  for (const x of [0.92, -0.92]) {
    for (const z of [0.72, -0.72]) {
      const wheel = new THREE.Group();

      const rubber = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.11, 12, 26), tyre);
      wheel.add(rubber);

      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.185, 0.185, 0.18, 18), rim);
      hub.rotation.x = Math.PI / 2;
      wheel.add(hub);

      // Five spokes. At this size they read as a wheel rather than a disc,
      // and cost almost nothing.
      for (let spoke = 0; spoke < 5; spoke += 1) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.28, 0.05), rim);
        bar.rotation.z = (spoke / 5) * Math.PI * 2;
        wheel.add(bar);
      }

      wheel.position.set(x, 0.3, z);
      wheel.rotation.y = Math.PI / 2;
      wheel.castShadow = true;

      car.add(wheel);
      wheels.push(wheel);
    }
  }

  car.userData.wheels = wheels;

  return car;
}

export function PassportScene({
  events = DEMO_EVENTS,
  onSelect,
  selectedId,
}: {
  events?: PassportEvent[];
  onSelect: (id: string) => void;
  selectedId: string | null;
}) {
  const mount = React.useRef<HTMLDivElement>(null);
  const [failed, setFailed] = React.useState(false);
  const selectedRef = React.useRef(selectedId);

  selectedRef.current = selectedId;

  React.useEffect(() => {
    const host = mount.current;
    if (!host) return;

    let renderer: THREE.WebGLRenderer;

    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      // Software rendering disabled, a locked-down browser, or no GPU at all.
      setFailed(true);
      return;
    }

    const quiet = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(4.6, 2.35, 4.6);
    camera.lookAt(0, 0.62, 0);

    // Capped at 2. Beyond that a retina display renders four times the pixels
    // for a difference nobody can see on a shape this simple.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(renderer.domElement);

    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.touchAction = 'pan-y';

    /* --- light ---------------------------------------------------------- */

    scene.add(new THREE.HemisphereLight(0xdfeff0, 0x1a2426, 1.15));

    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(3.5, 6.5, 4.5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 22;
    scene.add(key);

    // Cool, not brass. A warm fill at a grazing angle on a low-roughness
    // body turned the whole roof gold, which is how a petrol-green car came
    // out looking like a taxi.
    const fill = new THREE.DirectionalLight(0xcfe6e8, 0.7);
    fill.position.set(-5, 2.2, -4.5);
    scene.add(fill);

    /* --- the ground it stands on ---------------------------------------- */

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(3.4, 56),
      new THREE.ShadowMaterial({ opacity: 0.22 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.55, 2.58, 72),
      new THREE.MeshBasicMaterial({
        color: PALETTE.brass,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.002;
    scene.add(ring);

    /* --- the vehicle and its record ------------------------------------- */

    const turntable = new THREE.Group();
    scene.add(turntable);

    const car = buildVehicle();
    turntable.add(car);

    const markers = new Map<string, THREE.Mesh>();

    for (const event of events) {
      const colour =
        event.tone === 'alert'
          ? PALETTE.alert
          : event.tone === 'advisory'
            ? PALETTE.amber
            : PALETTE.brass;

      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.068, 16, 16),
        new THREE.MeshStandardMaterial({
          color: colour,
          emissive: colour,
          emissiveIntensity: 0.75,
          roughness: 0.3,
        }),
      );

      marker.position.set(...event.at);
      marker.userData.id = event.id;
      turntable.add(marker);
      markers.set(event.id, marker);

      // A halo, so a mark on the far side of the car still reads through the
      // bodywork rather than vanishing for half of every rotation.
      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(0.125, 14, 14),
        new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.16 }),
      );
      halo.position.copy(marker.position);
      turntable.add(halo);
    }

    /* --- pointer -------------------------------------------------------- */

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    let dragging = false;
    let moved = 0;
    let lastX = 0;
    let spin = 0.55;
    let velocity = 0;

    function resize() {
      const { clientWidth, clientHeight } = host!;
      if (clientWidth === 0 || clientHeight === 0) return;

      renderer.setSize(clientWidth, clientHeight, false);
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
    }

    function pick(event: PointerEvent): string | null {
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;

      raycaster.setFromCamera(pointer, camera);

      const hit = raycaster.intersectObjects([...markers.values()], false)[0];
      return (hit?.object.userData.id as string) ?? null;
    }

    function onDown(event: PointerEvent) {
      dragging = true;
      moved = 0;
      lastX = event.clientX;
      renderer.domElement.setPointerCapture(event.pointerId);
    }

    function onMove(event: PointerEvent) {
      if (dragging) {
        const delta = event.clientX - lastX;
        lastX = event.clientX;
        moved += Math.abs(delta);

        turntable.rotation.y += delta * 0.008;
        velocity = delta * 0.008;
        return;
      }

      renderer.domElement.style.cursor = pick(event) ? 'pointer' : 'grab';
    }

    function onUp(event: PointerEvent) {
      dragging = false;
      renderer.domElement.releasePointerCapture(event.pointerId);

      // A drag is not a click. Without this, every rotation selects whatever
      // happened to be under the finger when it stopped.
      if (moved > 6) return;

      const id = pick(event);
      if (id) onSelect(id);
    }

    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointermove', onMove);
    renderer.domElement.addEventListener('pointerup', onUp);

    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    /* --- the loop -------------------------------------------------------- */

    const clock = new THREE.Clock();
    let frame = 0;

    function tick() {
      frame = requestAnimationFrame(tick);

      const elapsed = clock.getElapsedTime();
      const delta = clock.getDelta();

      if (!dragging) {
        // Momentum after a drag, easing back into the idle turn. Stopping dead
        // feels like a bug; carrying on forever feels like a toy.
        velocity *= 0.94;
        turntable.rotation.y += velocity;

        if (!quiet) turntable.rotation.y += delta * spin * 0.25;
      }

      for (const [id, marker] of markers) {
        const chosen = id === selectedRef.current;
        const pulse = 1 + Math.sin(elapsed * 2.4 + marker.position.x) * 0.12;

        marker.scale.setScalar(chosen ? 1.45 : quiet ? 1 : pulse);

        const material = marker.material as THREE.MeshStandardMaterial;
        material.emissiveIntensity = chosen ? 1.6 : 0.75;
      }

      // The wheels turn with the turntable, so the car reads as moving rather
      // than as a model on a plinth.
      if (!quiet) {
        for (const wheel of car.userData.wheels as THREE.Group[]) {
          wheel.rotation.x -= delta * 1.2;
        }
      }

      renderer.render(scene, camera);
    }

    tick();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();

      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointermove', onMove);
      renderer.domElement.removeEventListener('pointerup', onUp);

      // Geometry and materials are not garbage collected on their own; a
      // component that mounts and unmounts leaks the GPU without this.
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const material = object.material;
          if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
          else material.dispose();
        }
      });

      renderer.dispose();
      host.removeChild(renderer.domElement);
      spin = 0;
    };
  }, [events, onSelect]);

  if (failed) return null;

  return <div ref={mount} aria-hidden className="absolute inset-0" style={{ cursor: 'grab' }} />;
}
