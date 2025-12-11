import * as THREE from 'three'
import { useLayoutEffect, useMemo, useRef, useState, useEffect } from 'react'
import { Canvas, extend, useFrame } from '@react-three/fiber'
import { Image, ScrollControls, useScroll, Billboard, Text } from '@react-three/drei'
import { suspend } from 'suspend-react'
import { generate } from 'random-words'
import { easing, geometry } from 'maath'

extend(geometry)
const inter = import('@pmndrs/assets/fonts/inter_regular.woff')

export const App = () => {
  useEffect(() => {
    // 记录所有 jukebox，便于通过一次点击统一控制  
    // ✨ Enregistrer tous les jukebox pour pouvoir les contrôler via un seul clic
    const jukeboxes = [];

    function createJukebox(audioId, sourceId, tracks, options = {}) {
      const audio = document.getElementById(audioId);
      const source = document.getElementById(sourceId);
      if (!audio || !source || !tracks || !tracks.length) return;

      let index = Math.floor(Math.random() * tracks.length);

      // 切换并准备下一首  
      // ✨ Charger et préparer la piste suivante
      function playTrack() {
        source.src = tracks[index];
        audio.load();

        // 加载元数据后跳到随机时间点（仅 DiskD）  
        // ✨ Sauter à un moment aléatoire après le chargement des métadonnées (DiskD uniquement)
        if (options.randomStart) {
          const setRandomStart = () => {
            audio.removeEventListener('loadedmetadata', setRandomStart);
            const duration = audio.duration;
            const len = isFinite(duration) ? duration : 3600;
            audio.currentTime = Math.random() * len;
          };
          audio.addEventListener('loadedmetadata', setRandomStart);
        }
      }

      // 音频结束后自动播放下一首  
      // ✨ Lecture automatique de la piste suivante à la fin de l’audio
      const onEnded = () => {
        index = (index + 1) % tracks.length;
        playTrack();
        // 尝试继续播放（如果已被用户解锁）  
        // ✨ Essayer de continuer la lecture (si déjà débloqué par l’utilisateur)
        audio.play().catch(() => {});
      };
      audio.addEventListener('ended', onEnded);

      // 初始化第一首曲目（只加载，不自动播放）  
      // ✨ Initialiser la première piste (charger seulement, sans lecture automatique)
      playTrack();

      // 记录当前 jukebox，供全局点击处理使用  
      // ✨ Enregistrer ce jukebox pour la gestion globale du clic
      jukeboxes.push({ audio, onEnded });
    }

    const cfg = window.APP_CONFIG;
    if (!cfg) return;

    // DiskC：正常播放  
    // ✨ DiskC : lecture normale
    createJukebox('DiskC', 'DiskCSource', cfg.DiskC, { randomStart: false });

    // DiskD：随机起始位置  
    // ✨ DiskD : démarrage à un moment aléatoire
    createJukebox('DiskD', 'DiskDSource', cfg.DiskD, { randomStart: true });

    // 全局点击处理：第一次点击解锁并开始播放音乐  
    // ✨ Gestion globale du clic : un clic pour débloquer et lancer la musique
    const handleClick = () => {
      jukeboxes.forEach(({ audio }) => {
        audio.play().catch(() => {
          // 忽略错误：如果浏览器仍然拒绝，我们就不再强求  
          // ✨ Ignorer les erreurs : si le navigateur refuse encore, on n’insiste pas
        });
      });

      // 只需要一次点击，之后移除监听器  
      // ✨ Un seul clic suffit, on retire ensuite l’écouteur
      document.removeEventListener('click', handleClick);
    };

    document.addEventListener('click', handleClick);

    // 清理事件监听器  
    // ✨ Nettoyer les écouteurs d’événements
    return () => {
      document.removeEventListener('click', handleClick);
      jukeboxes.forEach(({ audio, onEnded }) => {
        audio.removeEventListener('ended', onEnded);
      });
    };
  }, []);

  return (
    <Canvas dpr={[1, 1.5]}>
      <ScrollControls pages={4} infinite>
        <Scene position={[0, 1.5, 0]} />
      </ScrollControls>
    </Canvas>
  );
};

function Scene({ children, ...props }) {
  const ref = useRef()
  const scroll = useScroll()
  const [hovered, hover] = useState(null)
  useFrame((state, delta) => {
    ref.current.rotation.y = -scroll.offset * (Math.PI * 2) // Rotate contents
    state.events.update() // Raycasts every frame rather than on pointer-move
    easing.damp3(state.camera.position, [-state.pointer.x * 2, state.pointer.y * 2 + 4.5, 9], 0.3, delta)
    state.camera.lookAt(0, 0, 0)
  })
  return (
    <group ref={ref} {...props}>
      <Cards category="spring" from={0} len={Math.PI / 4} onPointerOver={hover} onPointerOut={hover} />
      <Cards category="summer" from={Math.PI / 4} len={Math.PI / 2} position={[0, 0.4, 0]} onPointerOver={hover} onPointerOut={hover} />
      <Cards category="autumn" from={Math.PI / 4 + Math.PI / 2} len={Math.PI / 2} onPointerOver={hover} onPointerOut={hover} />
      <Cards category="winter" from={Math.PI * 1.25} len={Math.PI * 2 - Math.PI * 1.25} position={[0, -0.4, 0]} onPointerOver={hover} onPointerOut={hover} />
      <ActiveCard hovered={hovered} />
    </group>
  )
}

function Cards({ category, data, from = 0, len = Math.PI * 2, radius = 5.25, onPointerOver, onPointerOut, ...props }) {
  const [hovered, hover] = useState(null)
  const amount = Math.round(len * 22)
  const textPosition = from + (amount / 2 / amount) * len
  return (
    <group {...props}>
      <Billboard position={[Math.sin(textPosition) * radius * 1.4, 0.5, Math.cos(textPosition) * radius * 1.4]}>
        <Text font={suspend(inter).default} fontSize={0.25} anchorX="center" color="black">
          {category}
        </Text>
      </Billboard>
      {Array.from({ length: amount - 3 /* minus 3 images at the end, creates a gap */ }, (_, i) => {
        const angle = from + (i / amount) * len
        return (
          <Card
            key={angle}
            onPointerOver={(e) => (e.stopPropagation(), hover(i), onPointerOver(i))}
            onPointerOut={() => (hover(null), onPointerOut(null))}
            position={[Math.sin(angle) * radius, 0, Math.cos(angle) * radius]}
            rotation={[0, Math.PI / 2 + angle, 0]}
            active={hovered !== null}
            hovered={hovered === i}
            url={`/img${Math.floor(i % 10) + 1}.jpg`}
          />
        )
      })}
    </group>
  )
}

function Card({ url, active, hovered, ...props }) {
  const ref = useRef()
  useFrame((state, delta) => {
    const f = hovered ? 1.4 : active ? 1.25 : 1
    easing.damp3(ref.current.position, [0, hovered ? 0.25 : 0, 0], 0.1, delta)
    easing.damp3(ref.current.scale, [1.618 * f, 1 * f, 1], 0.15, delta)
  })
  return (
    <group {...props}>
      <Image ref={ref} transparent radius={0.075} url={url} scale={[1.618, 1, 1]} side={THREE.DoubleSide} />
    </group>
  )
}

function ActiveCard({ hovered, ...props }) {
  const ref = useRef()
  const name = useMemo(() => generate({ exactly: 2 }).join(' '), [hovered])
  useLayoutEffect(() => void (ref.current.material.zoom = 0.8), [hovered])
  useFrame((state, delta) => {
    easing.damp(ref.current.material, 'zoom', 1, 0.5, delta)
    easing.damp(ref.current.material, 'opacity', hovered !== null, 0.3, delta)
  })
  return (
    <Billboard {...props}>
      <Text font={suspend(inter).default} fontSize={0.5} position={[2.15, 3.85, 0]} anchorX="left" color="black">
        {hovered !== null && `${name}\n${hovered}`}
      </Text>
      <Image ref={ref} transparent radius={0.3} position={[0, 1.5, 0]} scale={[3.5, 1.618 * 3.5, 0.2, 1]} url={`/img${Math.floor(hovered % 10) + 1}.jpg`} />
    </Billboard>
  )
}
