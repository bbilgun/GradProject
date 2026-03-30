import React, { useRef, useState, useEffect, Component } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  FlatList,
  Animated,
  Easing,
  BackHandler,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { markOnboardingSeen } from '@/utils/storage';

// ─── Constants ────────────────────────────────────────────────────

const { width } = Dimensions.get('window');

const BLUE  = '#08158F';
const GOLD  = '#FFC20D';
const WHITE = '#FFFFFF';
const MUTED = '#6B7280';
const BG    = '#F8F9FA';

const EASE = Easing.bezier(0.19, 1, 0.22, 1);

// ─── Slide data ───────────────────────────────────────────────────

const SLIDES = [
  {
    id: '1',
    lottie: require('@/assets/lottie/onboard1.json'),
    icon: 'school' as const,
    badge: 'Тавтай морил',
    title: 'ШУТИС Гарын Авлага',
    body: 'Оюутны амьдралын бүх мэдээлэл нэг дороос. Хичээл, дүрэм, тэтгэлэг болон бусад бүх зүйлийг хялбархан олоорой.',
    accent: BLUE,
  },
  {
    id: '2',
    lottie: require('@/assets/lottie/onboard2.json'),
    icon: 'auto-awesome' as const,
    badge: 'AI Технологи',
    title: 'Хиймэл Оюунаар Хайлт',
    body: 'AI туслахын тусламжтайгаар гарын авлагын агуулгаас хурдан, тодорхой хариулт авна уу. Аль ч асуултад хариулт байна.',
    accent: GOLD,
  },
  {
    id: '3',
    lottie: require('@/assets/lottie/onboard3.json'),
    icon: 'bookmark' as const,
    badge: 'Бүгд нэг дороос',
    title: 'Хадгалах & Баримт',
    body: 'ШУТИС-ийн бүх баримт бичиг, дүрэм журамтай танилцаж, өөрт хэрэгтэй бүлгүүдийг хадгалаарай.',
    accent: BLUE,
  },
];

// ─── Screen ───────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const router = useRouter();
  const flatRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;

  // Block Android hardware back during onboarding
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  const goNext = () => {
    const next = currentIndex + 1;
    flatRef.current?.scrollToIndex({ index: next, animated: true });
    setCurrentIndex(next);
  };

  /** Complete onboarding — sets flag so HomeScreen stops redirecting */
  const complete = () => {
    markOnboardingSeen();
    router.replace('/' as any);
  };

  /** "Дахин харуулахгүй" — same as complete, explicit user intent */
  const neverShowAgain = () => {
    markOnboardingSeen();
    router.replace('/' as any);
  };

  /** "Алгасах" — skip THIS session, flag NOT set, onboarding shows on next reload */
  const skipOnce = () => {
    markOnboardingSeen(); // still set for this session to avoid loop
    router.replace('/' as any);
  };

  const isLast = currentIndex === SLIDES.length - 1;

  return (
    <View style={{ flex: 1, backgroundColor: WHITE }}>
      <StatusBar style="dark" />

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>

        {/* Skip-once (top-right, hidden on last slide) */}
        <View style={{
          height: 44,
          flexDirection: 'row',
          justifyContent: 'flex-end',
          alignItems: 'center',
          paddingHorizontal: 24,
        }}>
          {!isLast && (
            <TouchableOpacity
              onPress={skipOnce}
              hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}
            >
              <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, color: MUTED }}>
                Алгасах
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Slides */}
        <FlatList
          ref={flatRef}
          data={SLIDES}
          horizontal
          pagingEnabled
          bounces={false}
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: false }
          )}
          onMomentumScrollEnd={e => {
            setCurrentIndex(Math.round(e.nativeEvent.contentOffset.x / width));
          }}
          keyExtractor={s => s.id}
          style={{ flex: 1 }}
          renderItem={({ item }) => <Slide item={item} />}
        />

        {/* Bottom controls */}
        <View style={{ paddingHorizontal: 24, paddingBottom: 8 }}>

          {/* Animated dots */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 28 }}>
            {SLIDES.map((_, i) => (
              <AnimatedDot key={i} scrollX={scrollX} index={i} />
            ))}
          </View>

          {/* Primary CTA */}
          <TouchableOpacity
            onPress={isLast ? complete : goNext}
            activeOpacity={0.88}
            style={{
              backgroundColor: BLUE,
              borderRadius: 16,
              paddingVertical: 17,
              alignItems: 'center',
              marginBottom: 16,
              shadowColor: 'rgba(8,21,143,0.4)',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 1,
              shadowRadius: 20,
              elevation: 10,
            }}
          >
            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 16, color: WHITE, letterSpacing: 0.2 }}>
              {isLast ? 'Эхлэх' : 'Дараагийнх →'}
            </Text>
          </TouchableOpacity>

          {/* Don't show again — explicit, persistent */}
          <TouchableOpacity
            onPress={neverShowAgain}
            style={{ alignItems: 'center', paddingVertical: 10 }}
            hitSlop={{ top: 6, bottom: 6, left: 20, right: 20 }}
          >
            <Text style={{
              fontFamily: 'Inter_400Regular', fontSize: 13, color: MUTED,
              textDecorationLine: 'underline',
            }}>
              Дахин харуулахгүй
            </Text>
          </TouchableOpacity>

        </View>
      </SafeAreaView>
    </View>
  );
}

// ─── Slide ────────────────────────────────────────────────────────

function Slide({ item }: { item: typeof SLIDES[number] }) {
  return (
    <View style={{ width, flex: 1, alignItems: 'center', paddingHorizontal: 28 }}>

      {/* Illustration — Lottie with animated fallback */}
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <LottieErrorBoundary fallback={<FallbackIllustration icon={item.icon} accent={item.accent} />}>
          <LottiePlayer source={item.lottie} />
        </LottieErrorBoundary>
      </View>

      {/* Text block */}
      <View style={{ width: '100%', paddingBottom: 22 }}>
        <View style={{
          alignSelf: 'center',
          backgroundColor: 'rgba(255,194,13,0.15)',
          borderRadius: 999,
          paddingHorizontal: 14,
          paddingVertical: 5,
          marginBottom: 14,
        }}>
          <Text style={{
            fontFamily: 'Inter_600SemiBold', fontSize: 12,
            color: '#996600', letterSpacing: 0.4,
          }}>
            {item.badge}
          </Text>
        </View>

        <Text style={{
          fontFamily: 'Inter_700Bold', fontSize: 25,
          color: BLUE, textAlign: 'center',
          letterSpacing: -0.5, lineHeight: 33,
          marginBottom: 13,
        }}>
          {item.title}
        </Text>

        <Text style={{
          fontFamily: 'Inter_400Regular', fontSize: 15,
          color: MUTED, textAlign: 'center', lineHeight: 24,
        }}>
          {item.body}
        </Text>
      </View>
    </View>
  );
}

// ─── Lottie player (lazy — only runs after native rebuild) ────────

function LottiePlayer({ source }: { source: any }) {
  // Dynamic require avoids a crash at module-load time when the native
  // module is not yet linked (before npx expo run:ios).
  const LottieView = require('lottie-react-native').default;
  return (
    <LottieView
      source={source}
      autoPlay
      loop
      resizeMode="contain"
      style={{ width: width * 0.80, height: width * 0.80 }}
    />
  );
}

// ─── Fallback illustration (pure React Native, no native deps) ────

function FallbackIllustration({
  icon, accent,
}: {
  icon: 'school' | 'auto-awesome' | 'bookmark';
  accent: string;
}) {
  const pulse   = useRef(new Animated.Value(1)).current;
  const ring    = useRef(new Animated.Value(0.7)).current;
  const ringOp  = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.07, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.parallel([
        Animated.timing(ring,   { toValue: 1.4, duration: 1600, easing: EASE, useNativeDriver: true }),
        Animated.timing(ringOp, { toValue: 0,   duration: 1600, easing: EASE, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const SIZE = width * 0.56;

  return (
    <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
      {/* Expanding ring */}
      <Animated.View style={{
        position: 'absolute',
        width: SIZE, height: SIZE, borderRadius: SIZE / 2,
        borderWidth: 2,
        borderColor: accent,
        opacity: ringOp,
        transform: [{ scale: ring }],
      }} />

      {/* Solid circle */}
      <Animated.View style={{
        width: SIZE * 0.78, height: SIZE * 0.78, borderRadius: SIZE * 0.39,
        backgroundColor: accent === GOLD ? 'rgba(255,194,13,0.12)' : 'rgba(8,21,143,0.09)',
        alignItems: 'center', justifyContent: 'center',
        transform: [{ scale: pulse }],
      }}>
        <MaterialIcons name={icon} size={SIZE * 0.38} color={accent === GOLD ? '#996600' : BLUE} />
      </Animated.View>
    </View>
  );
}

// ─── Error Boundary for LottiePlayer ─────────────────────────────

interface EBProps { children: React.ReactNode; fallback: React.ReactNode; }
interface EBState { crashed: boolean; }

class LottieErrorBoundary extends Component<EBProps, EBState> {
  state: EBState = { crashed: false };

  static getDerivedStateFromError(): EBState {
    return { crashed: true };
  }

  render() {
    return this.state.crashed ? this.props.fallback : this.props.children;
  }
}

// ─── Animated dot ─────────────────────────────────────────────────

function AnimatedDot({ scrollX, index }: { scrollX: Animated.Value; index: number }) {
  const inputRange = [(index - 1) * width, index * width, (index + 1) * width];

  const dotWidth = scrollX.interpolate({
    inputRange, outputRange: [8, 26, 8], extrapolate: 'clamp',
  });
  const opacity = scrollX.interpolate({
    inputRange, outputRange: [0.25, 1, 0.25], extrapolate: 'clamp',
  });

  return (
    <Animated.View style={{
      width: dotWidth, height: 8, borderRadius: 4,
      backgroundColor: BLUE, opacity,
      marginHorizontal: 4,
    }} />
  );
}
