import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  Animated,
  Easing,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { useBookmarks } from '@/contexts/BookmarkContext';
import HandbookService from '@/services/handbook_service';
import { EaseOutExpo, Space } from '@/constants/Theme';

// ─── Design tokens ────────────────────────────────────────────────

const BLUE   = '#08158F';
const GOLD   = '#FFC20D';
const BG     = '#F8F9FA';
const WHITE  = '#FFFFFF';
const MUTED  = '#6B7280';
const BORDER = 'rgba(8,21,143,0.09)';

const EASE = Easing.bezier(...EaseOutExpo);

// ─── Screen ───────────────────────────────────────────────────────

export default function BookmarksScreen() {
  const router = useRouter();
  const { bookmarks, toggle } = useBookmarks();

  const savedSections = HandbookService.getAllSections().filter(s => bookmarks.has(s.id));

  // Build rows of 2
  const rows: (typeof savedSections)[] = [];
  for (let i = 0; i < savedSections.length; i += 2) {
    rows.push(savedSections.slice(i, i + 2));
  }

  // Header entrance animation
  const headerOp = useRef(new Animated.Value(0)).current;
  const headerY  = useRef(new Animated.Value(-10)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerOp, { toValue: 1, duration: 380, easing: EASE, useNativeDriver: true }),
      Animated.timing(headerY,  { toValue: 0, duration: 380, easing: EASE, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar barStyle="light-content" backgroundColor={BLUE} />

      {/* ── Blue header ─────────────────────────────────────── */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: BLUE }}>
        <Animated.View style={{
          opacity: headerOp,
          transform: [{ translateY: headerY }],
          paddingHorizontal: 20,
          paddingTop: 10,
          paddingBottom: 24,
        }}>
          {/* Top row: logo */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <Image
              source={require('@/assets/images/main_logo.png')}
              style={{ width: 36, height: 36, borderRadius: 8 }}
              resizeMode="contain"
            />
            <View style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: 'rgba(255,255,255,0.13)',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <MaterialIcons name="bookmark" size={19} color={GOLD} />
            </View>
          </View>
          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 26, color: WHITE, letterSpacing: -0.5, marginBottom: 4 }}>
            Хадгалсан
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {savedSections.length > 0 && (
              <View style={{ backgroundColor: GOLD, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#1A1A2E' }}>
                  {savedSections.length} бүлэг
                </Text>
              </View>
            )}
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: 'rgba(255,255,255,0.60)' }}>
              {savedSections.length > 0 ? 'хадгалагдсан' : 'Хадгалсан бүлэг байхгүй байна'}
            </Text>
          </View>
        </Animated.View>
        {/* Rounded bottom edge */}
        <View style={{ height: 22, backgroundColor: BG, borderTopLeftRadius: 22, borderTopRightRadius: 22, marginTop: -1 }} />
      </SafeAreaView>

      {/* ── Content ─────────────────────────────────────────── */}
      {savedSections.length === 0 ? (
        <EmptyState onBrowse={() => router.push('/(tabs)/' as any)} />
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: Space.gutter, paddingBottom: 110 }}
          showsVerticalScrollIndicator={false}
        >
          {rows.map((row, rowIdx) => (
            <View key={rowIdx} style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
              {row[0] && (
                <BookmarkCard
                  section={row[0]}
                  onPress={() => router.push({ pathname: '/handbook/[slug]' as any, params: { slug: row[0].id } })}
                  onRemove={() => toggle(row[0].id)}
                />
              )}
              {row[1] ? (
                <BookmarkCard
                  section={row[1]}
                  onPress={() => router.push({ pathname: '/handbook/[slug]' as any, params: { slug: row[1].id } })}
                  onRemove={() => toggle(row[1].id)}
                />
              ) : (
                <View style={{ flex: 1 }} />
              )}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

// ─── Bookmark Card ────────────────────────────────────────────────

function BookmarkCard({
  section, onPress, onRemove,
}: {
  section: ReturnType<typeof HandbookService.getAllSections>[number];
  onPress: () => void;
  onRemove: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const EASE  = Easing.bezier(...EaseOutExpo);

  const pressIn  = () => Animated.timing(scale, { toValue: 0.96, duration: 100, easing: EASE, useNativeDriver: true }).start();
  const pressOut = () => Animated.timing(scale, { toValue: 1,    duration: 180, easing: EASE, useNativeDriver: true }).start();

  return (
    <Animated.View style={{ transform: [{ scale }], flex: 1 }}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={{
          backgroundColor: WHITE,
          borderRadius: 16,
          padding: 16,
          minHeight: 138,
          borderWidth: 1,
          borderColor: BORDER,
          shadowColor: 'rgba(8,21,143,0.06)',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 1,
          shadowRadius: 8,
          elevation: 2,
          justifyContent: 'space-between',
        }}
      >
        {/* Icon row + remove button */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <View style={{
            width: 44, height: 44, borderRadius: 12,
            backgroundColor: 'rgba(8,21,143,0.08)',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <MaterialIcons name={section.icon as any} size={24} color={BLUE} />
          </View>
          <TouchableOpacity
            onPress={onRemove}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{
              width: 28, height: 28, borderRadius: 8,
              backgroundColor: 'rgba(8,21,143,0.06)',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <MaterialIcons name="bookmark" size={16} color={BLUE} />
          </TouchableOpacity>
        </View>

        {/* Text */}
        <View>
          <Text numberOfLines={2} style={{
            fontFamily: 'Inter_700Bold', fontSize: 13,
            color: BLUE, lineHeight: 18, marginBottom: 3,
          }}>
            {section.title}
          </Text>
          <Text numberOfLines={1} style={{
            fontFamily: 'Inter_400Regular', fontSize: 11, color: MUTED,
          }}>
            {section.description}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Empty State ──────────────────────────────────────────────────

function EmptyState({ onBrowse }: { onBrowse: () => void }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const op    = useRef(new Animated.Value(0)).current;
  const EASE  = Easing.bezier(...EaseOutExpo);

  useEffect(() => {
    Animated.timing(op, { toValue: 1, duration: 400, easing: EASE, useNativeDriver: true }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 1000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 1000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={{
      flex: 1, opacity: op,
      alignItems: 'center', justifyContent: 'center',
      paddingHorizontal: 40,
    }}>
      <Animated.View style={{
        transform: [{ scale: pulse }],
        width: 72, height: 72, borderRadius: 20,
        backgroundColor: 'rgba(8,21,143,0.06)',
        alignItems: 'center', justifyContent: 'center',
        marginBottom: 20,
      }}>
        <MaterialIcons name="bookmark-border" size={36} color="rgba(8,21,143,0.35)" />
      </Animated.View>

      <Text style={{
        fontFamily: 'Inter_700Bold', fontSize: 17,
        color: BLUE, marginBottom: 8, textAlign: 'center',
      }}>
        Хадгалсан зүйл байхгүй
      </Text>
      <Text style={{
        fontFamily: 'Inter_400Regular', fontSize: 13,
        color: MUTED, textAlign: 'center', lineHeight: 20, marginBottom: 28,
      }}>
        Бүлгийн дээр дарахад гарах{' '}
        <Text style={{ color: BLUE, fontFamily: 'Inter_600SemiBold' }}>хавчуур</Text>
        {' '}товчийг дарж хадгалаарай
      </Text>

      <TouchableOpacity
        onPress={onBrowse}
        style={{
          backgroundColor: BLUE, borderRadius: 14,
          paddingHorizontal: 28, paddingVertical: 13,
        }}
      >
        <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: WHITE }}>
          Бүлгүүд үзэх
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}
