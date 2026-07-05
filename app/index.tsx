import Slider from '@react-native-community/slider'; // Ensure your project has this or uses native layouts fallback
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getDatabaseConnection, initDatabase } from '../src/services/db';
import { useUserStore } from '../src/services/store';

const { width } = Dimensions.get('window');

interface ActiveTrackedExercise {
  workout_exercise_id: number;
  exercise_id: number;
  name: string;
  primary_muscle: string;
  sub_muscle: string;
  difficulty: number;
  gender: string;
  base_multiplier: number;
  sets: Array<{
    id: string;
    weight: string;
    reps: string;
    isCompleted: boolean;
  }>;
}

export default function WorkspaceDashboard() {
  const store = useUserStore();
  
  // App Boot & Internal Stage Loops States
  const [isSplashing, setIsSplashing] = useState<boolean>(true);
  const [onboardingStage, setOnboardingStage] = useState<'WELCOME' | 'STEP_1' | 'STEP_2'>('WELCOME');
  
  const [activeWorkoutName, setActiveWorkoutName] = useState<string>('Loading...');
  const [trackedExercises, setTrackedExercises] = useState<ActiveTrackedExercise[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  // Workspace Tracker Modal States
  const [isModalVisible, setIsModalVisible] = useState<boolean>(false);
  const [customName, setCustomName] = useState<string>('');
  const [customPrimary, setCustomPrimary] = useState<string>('Chest');
  const [customSub, setCustomSub] = useState<string>('');

  // Premium Onboarding Form Values Defaults
  const [formAge, setFormAge] = useState<number>(22);
  const [formWeight, setFormWeight] = useState<number>(75); // Slider default in kg
  const [formHeight, setFormHeight] = useState<number>(175); // Slider default in cm
  const [formGender, setFormGender] = useState<'M' | 'F' | 'U'>('U');
  const [formExp, setFormExp] = useState<'Beginner' | 'Familiar' | 'Advanced'>('Beginner');
  const [formSplit, setFormSplit] = useState<'3_DAY' | '4_DAY' | '5_DAY' | 'CUSTOM'>('5_DAY');

  // Descriptions for dynamically selected splits
  const splitDescriptions = {
    '3_DAY': 'Alternating Push, Pull, Legs sequence loop. Excellent for baseline motor recovery paths.',
    '4_DAY': 'Focused Upper/Lower targeted muscle isolation volume framework layout.',
    '5_DAY': 'Premium Hypertrophy Bro-Split sequence targeting explicit standalone muscle groups daily.',
    'CUSTOM': 'Completely blank sheet mapping. Build your daily routines fully from scratch.'
  };

  useEffect(() => {
    // 500ms Splash branding timer logic sequence
    const timer = setTimeout(() => {
      setIsSplashing(false);
    }, 500);

    async function bootTrackingEngine() {
      try {
        await initDatabase();
        if (store.isOnboarded) {
          await loadCurrentActiveWorkoutDay();
        }
      } catch (error) {
        console.error('Initialization error:', error);
      } finally {
        setIsLoading(false);
      }
    }

    bootTrackingEngine();
    return () => clearTimeout(timer);
  }, [store.isOnboarded, store.currentWorkoutDayOrder]);

  async function loadCurrentActiveWorkoutDay() {
    const db = await getDatabaseConnection();
    const currentWorkout = await db.getFirstAsync<{ id: number; name: string }>(
      'SELECT id, name FROM workouts WHERE split_type = ? AND day_order = ?;',
      [store.activeSplit, store.currentWorkoutDayOrder]
    );

    if (!currentWorkout) {
      setActiveWorkoutName(`${store.activeSplit.replace('_', ' ')} Session`);
      setTrackedExercises([]);
      return;
    }

    setActiveWorkoutName(currentWorkout.name);

    const exercisesList = await db.getAllAsync<{
      workout_exercise_id: number;
      exercise_id: number;
      name: string;
      primary_muscle: string;
      sub_muscle: string;
      difficulty: number;
      gender: string;
      base_multiplier: number;
      target_sets: number;
      target_reps: number;
    }>(
      `SELECT we.id as workout_exercise_id, e.id as exercise_id, e.name, e.primary_muscle, e.sub_muscle, e.difficulty, e.gender, e.base_multiplier, we.target_sets, we.target_reps
       FROM workout_exercises we
       JOIN exercises e ON we.exercise_id = e.id
       WHERE we.workout_id = ? ORDER BY we.sequence_order ASC;`,
      [currentWorkout.id]
    );

    let expModifier = 1.0;
    if (store.experienceLevel === 'Familiar') expModifier = 1.25;
    if (store.experienceLevel === 'Advanced') expModifier = 1.5;

    let amf = 1.0;
    if (store.age >= 40 && store.age <= 55) amf = 0.90;
    if (store.age > 55) amf = 0.80;

    const massagedExercises: ActiveTrackedExercise[] = exercisesList.map((ex) => {
      const calculatedWeight = Math.round(store.weight * ex.base_multiplier * expModifier * amf);
      const computedSets = Array.from({ length: ex.target_sets }).map((_, index) => ({
        id: `${ex.workout_exercise_id}_${index}`,
        weight: calculatedWeight.toString(),
        reps: ex.target_reps.toString(),
        isCompleted: false
      }));

      return {
        workout_exercise_id: ex.workout_exercise_id,
        exercise_id: ex.exercise_id,
        name: ex.name,
        primary_muscle: ex.primary_muscle,
        sub_muscle: ex.sub_muscle,
        difficulty: ex.difficulty,
        gender: ex.gender,
        base_multiplier: ex.base_multiplier,
        sets: computedSets
      };
    });

    setTrackedExercises(massagedExercises);
  }

  const toggleSetCompletion = (exerciseIndex: number, setIndex: number) => {
    const updated = [...trackedExercises];
    updated[exerciseIndex].sets[setIndex].isCompleted = !updated[exerciseIndex].sets[setIndex].isCompleted;
    setTrackedExercises(updated);
  };

  async function handleAddCustomExercise() {
    if (!customName.trim()) return;
    try {
      const db = await getDatabaseConnection();
      const verifiedSub = customSub.trim() ? customSub.trim() : 'General Custom';
      
      await db.runAsync(
        `INSERT OR IGNORE INTO exercises (name, primary_muscle, sub_muscle, difficulty, gender, base_multiplier) VALUES (?, ?, ?, ?, ?, ?);`,
        [customName, customPrimary, verifiedSub, 1, 'U', 0.20]
      );

      const targetEx = await db.getFirstAsync<{ id: number }>('SELECT id FROM exercises WHERE name = ?;', [customName]);
      if (!targetEx) return;

      const appendedExercise: ActiveTrackedExercise = {
        workout_exercise_id: Date.now(),
        exercise_id: targetEx.id,
        name: customName,
        primary_muscle: customPrimary,
        sub_muscle: verifiedSub,
        difficulty: 1,
        gender: 'U',
        base_multiplier: 0.20,
        sets: [
          { id: `${Date.now()}_0`, weight: '20', reps: '10', isCompleted: false },
          { id: `${Date.now()}_1`, weight: '20', reps: '10', isCompleted: false }
        ]
      };

      setTrackedExercises([...trackedExercises, appendedExercise]);
      setCustomName('');
      setCustomSub('');
      setIsModalVisible(false);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleFinishWorkoutSession() {
    try {
      const db = await getDatabaseConnection();
      const timestamp = new Date().toISOString().split('T')[0];
      
      let totalSets = 0;
      trackedExercises.forEach(ex => {
        ex.sets.forEach(s => { if (s.isCompleted) totalSets++; });
      });

      await db.runAsync(
        'INSERT INTO completed_workouts (workout_name, split_type, date_logged, total_sets_completed) VALUES (?, ?, ?, ?);',
        [activeWorkoutName, store.activeSplit, timestamp, totalSets]
      );

      await db.runAsync(
        'INSERT OR REPLACE INTO calendar_logs (log_date, status_type, workout_session_id) VALUES (?, ?, (SELECT last_insert_rowid()));',
        [timestamp, 'WORKOUT']
      );

      alert('Workout Cleanly Logged! 💪');
      store.advanceToNextWorkoutDay();
    } catch (err) {
      console.error(err);
    }
  }

  function runOnboardingSubmit() {
    store.completeOnboarding({
      age: formAge,
      weight: formWeight,
      height: formHeight,
      gender: formGender,
      experienceLevel: formExp,
      activeSplit: formSplit
    });
  }

  // 1. BRANDING SPLIT FLASH WINDOW
  if (isSplashing) {
    return (
      <View style={styles.splashContainer}>
        <Text style={styles.splashLogoText}>GYM CORE</Text>
        <ActivityIndicator size="small" color="#FF6B00" style={{ marginTop: 12 }} />
      </View>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centeredContainer}>
        <ActivityIndicator size="large" color="#FF6B00" />
      </SafeAreaView>
    );
  }

  // 2. STYLED NIKE-THEME MULTI-STEP ONBOARDING ENGINE FLOW
  if (!store.isOnboarded) {
    return (
      <SafeAreaView style={styles.onboardingContainer}>
        
        {onboardingStage === 'WELCOME' && (
          <View style={styles.fullFlexContent}>
            <View style={styles.centerHeroBlock}>
              <Text style={styles.brandAccentLabel}>GYM CORE</Text>
              <Text style={styles.onboardHeroTitle}>Your gym journey starts here.</Text>
            </View>
            <View style={styles.onboardFooterActionBlock}>
              <Text style={styles.timeNoticeLabel}>Takes about 45 seconds</Text>
              <TouchableOpacity style={styles.nikePrimaryBtn} onPress={() => setOnboardingStage('STEP_1')}>
                <Text style={styles.nikePrimaryBtnText}>Let's Get Started</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {onboardingStage === 'STEP_1' && (
          <ScrollView contentContainerStyle={styles.scrollFormPadding}>
            <Text style={styles.sectionQuestionTitle}>How old are you?</Text>
            <View style={styles.ageStepperRow}>
              <TouchableOpacity onPress={() => setFormAge(prev => Math.max(15, prev - 1))} style={styles.stepperArrowBtn}>
                <Text style={styles.stepperArrowText}>&lt;</Text>
              </TouchableOpacity>
              <Text style={styles.activeAgeDisplayValue}>{formAge}</Text>
              <TouchableOpacity onPress={() => setFormAge(prev => Math.min(90, prev + 1))} style={styles.stepperArrowBtn}>
                <Text style={styles.stepperArrowText}>&gt;</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionQuestionTitle}>How tall are you?</Text>
            <Text style={styles.sliderValueMetricText}>{formHeight} cm</Text>
            <Slider
              style={styles.nikeSliderTrack}
              minimumValue={130}
              maximumValue={220}
              step={1}
              value={formHeight}
              minimumTrackTintColor="#FF6B00"
              maximumTrackTintColor="#222222"
              thumbTintColor="#FF6B00"
              onValueChange={(val: number) => setFormHeight(val)}
            />

            <Text style={styles.sectionQuestionTitle}>Current weight?</Text>
            <Text style={styles.sliderValueMetricText}>{formWeight} kg</Text>
            <Slider
              style={styles.nikeSliderTrack}
              minimumValue={40}
              maximumValue={180}
              step={1}
              value={formWeight}
              minimumTrackTintColor="#FF6B00"
              maximumTrackTintColor="#222222"
              thumbTintColor="#FF6B00"
              onValueChange={(val: number) => setFormWeight(val)}
            />

            <View style={styles.formFooterRowBlock}>
              <Text style={styles.stepIndicatorLabelText}>Step 1 of 2</Text>
              <TouchableOpacity style={styles.nikePrimaryBtn} onPress={() => setOnboardingStage('STEP_2')}>
                <Text style={styles.nikePrimaryBtnText}>Next Step</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}

        {onboardingStage === 'STEP_2' && (
          <ScrollView contentContainerStyle={styles.scrollFormPadding}>
            <Text style={styles.sectionQuestionTitle}>Select preferred profile</Text>
            <View style={styles.genderChipRow}>
              {([
                { key: 'M', label: 'Male Profile' },
                { key: 'F', label: 'Female Profile' },
                { key: 'U', label: 'Unisex Baseline' }
              ] as const).map(g => (
                <TouchableOpacity 
                  key={g.key} 
                  style={[styles.premiumCustomCheckboxCard, formGender === g.key && styles.checkboxCardActive]} 
                  onPress={() => setFormGender(g.key)}
                >
                  <View style={[styles.customCircleIndicatorCheck, formGender === g.key && styles.circleIndicatorChecked]} />
                  <Text style={styles.checkboxLabelText}>{g.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionQuestionTitle}>Prior experience level</Text>
            <View style={styles.splitSelectionColumnWrap}>
              {([
                { key: 'Beginner', desc: 'Beginner (0-3 months)' },
                { key: 'Familiar', desc: 'Familiar (3-12 months)' },
                { key: 'Advanced', desc: 'Advanced (12+ months)' }
              ] as const).map(level => (
                <TouchableOpacity 
                  key={level.key} 
                  style={[styles.splitSelectionRowChip, formExp === level.key && styles.splitSelectionRowChipActive]} 
                  onPress={() => setFormExp(level.key)}
                >
                  <Text style={[styles.splitChipMainText, formExp === level.key && styles.splitChipMainTextActive]}>{level.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionQuestionTitle}>Workout split structure</Text>
            <View style={styles.splitSelectionColumnWrap}>
              {(['3_DAY', '4_DAY', '5_DAY', 'CUSTOM'] as const).map(split => (
                <TouchableOpacity 
                  key={split} 
                  style={[styles.splitSelectionRowChip, formSplit === split && styles.splitSelectionRowChipActive]} 
                  onPress={() => setFormSplit(split)}
                >
                  <Text style={[styles.splitChipMainText, formSplit === split && styles.splitChipMainTextActive]}>{split.replace('_', ' ')} Split</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Dynamic context block displaying contextual help based on split selection */}
            <View style={styles.dynamicSplitExplanationContainer}>
              <Text style={styles.explanationTextContent}>{splitDescriptions[formSplit]}</Text>
            </View>

            <View style={styles.formFooterRowBlock}>
              <Text style={styles.stepIndicatorLabelText}>Step 2 of 2</Text>
              <TouchableOpacity style={styles.nikePrimaryBtn} onPress={useUserStore.getState().isOnboarded ? () => {} : runOnboardingSubmit}>
                <Text style={styles.nikePrimaryBtnText}>Let's Lift 💪</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    );
  }

  // 3. CORE ACTIVE TRACKING CONTEXT DISPLAY (POST-ONBOARDING MAPPED VIEW)
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerLabel}>QUEUE DAY {store.currentWorkoutDayOrder}</Text>
          <Text style={styles.workoutTitle}>{activeWorkoutName}</Text>
        </View>
        <TouchableOpacity style={styles.customBtn} onPress={() => setIsModalVisible(true)}>
          <Text style={styles.customBtnText}>+ Custom Movement</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={trackedExercises}
        keyExtractor={(item) => item.workout_exercise_id.toString()}
        contentContainerStyle={styles.listContent}
        renderItem={({ item: exercise, index: exIdx }) => (
          <View style={styles.exerciseCard}>
            <View style={styles.exerciseHeader}>
              <Text style={styles.exerciseName}>{exercise.name}</Text>
              <Text style={styles.muscleBadge}>{exercise.primary_muscle}</Text>
            </View>

            {exercise.sets.map((set, setIdx) => (
              <View key={set.id} style={[styles.setRow, set.isCompleted && styles.setRowCompleted]}>
                <Text style={styles.setNumberLabel}>Set {setIdx + 1}</Text>
                <View style={styles.inputWrap}>
                  <TextInput style={styles.numericInput} value={set.weight} keyboardType="numeric" onChangeText={(txt) => {
                    const updated = [...trackedExercises];
                    updated[exIdx].sets[setIdx].weight = txt;
                    setTrackedExercises(updated);
                  }} />
                  <Text style={styles.inputUnit}>kg</Text>
                </View>

                <View style={styles.inputWrap}>
                  <TextInput style={styles.numericInput} value={set.reps} keyboardType="numeric" onChangeText={(txt) => {
                    const updated = [...trackedExercises];
                    updated[exIdx].sets[setIdx].reps = txt;
                    setTrackedExercises(updated);
                  }} />
                  <Text style={styles.inputUnit}>reps</Text>
                </View>

                <TouchableOpacity style={[styles.checkSquare, set.isCompleted && styles.checkSquareChecked]} onPress={() => toggleSetCompletion(exIdx, setIdx)}>
                  <Text style={styles.checkIcon}>{set.isCompleted ? '✓' : ''}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      />

      <View style={styles.footer}>
        <TouchableOpacity style={styles.finishBtn} onPress={handleFinishWorkoutSession}>
          <Text style={styles.finishBtnText}>Finish Workout Session (Advance Queue)</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={isModalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Add Custom Exercise</Text>
            <Text style={styles.fieldLabel}>Exercise Name</Text>
            <TextInput style={styles.formInput} placeholder="e.g., Incline Dumbbell Fly" placeholderTextColor="#64748B" value={customName} onChangeText={setCustomName} />

            <Text style={styles.fieldLabel}>Primary Muscle Target Group</Text>
            <View style={styles.pickerAlternativeRow}>
              {['Chest', 'Back', 'Biceps', 'Triceps', 'Shoulder', 'Legs'].map((muscle) => (
                <TouchableOpacity key={muscle} style={[styles.pickerChip, customPrimary === muscle && styles.pickerChipActive]} onPress={() => setCustomPrimary(muscle)}>
                  <Text style={[styles.pickerChipText, customPrimary === muscle && styles.pickerChipTextActive]}>{muscle}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Sub Category (Optional)</Text>
            <TextInput style={styles.formInput} placeholder="Leaves blank for General Custom" placeholderTextColor="#64748B" value={customSub} onChangeText={setCustomSub} />

            <View style={styles.modalActionRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsModalVisible(false)}><Text style={styles.cancelBtnText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleAddCustomExercise}><Text style={styles.saveBtnText}>Add Movement</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Premium Minimalist Dark Theme Palette Configuration
  container: { flex: 1, backgroundColor: '#000000' },
  onboardingContainer: { flex: 1, backgroundColor: '#000000' },
  centeredContainer: { flex: 1, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center' },
  splashContainer: { flex: 1, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center' },
  splashLogoText: { fontSize: 32, fontWeight: '900', color: '#FF6B00', letterSpacing: 4 },
  fullFlexContent: { flex: 1, justifyContent: 'space-between', padding: 24 },
  centerHeroBlock: { flex: 1, justifyContent: 'center', alignItems: 'flex-start', paddingBottom: 60 },
  brandAccentLabel: { color: '#FF6B00', fontSize: 13, fontWeight: '900', letterSpacing: 3, marginBottom: 8 },
  onboardHeroTitle: { fontSize: 36, fontWeight: '900', color: '#F8FAFC', lineHeight: 44, letterSpacing: -0.5 },
  onboardFooterActionBlock: { width: '100%', alignItems: 'center', marginBottom: 12 },
  timeNoticeLabel: { color: '#64748B', fontSize: 13, fontWeight: '600', marginBottom: 16 },
  nikePrimaryBtn: { backgroundColor: '#FF6B00', width: '100%', paddingVertical: 16, borderRadius: 30, alignItems: 'center' },
  nikePrimaryBtnText: { color: '#000000', fontWeight: '900', fontSize: 16, letterSpacing: 0.5 },
  scrollFormPadding: { padding: 24, paddingBottom: 60 },
  sectionQuestionTitle: { fontSize: 20, fontWeight: '900', color: '#F8FAFC', marginTop: 24, marginBottom: 14, letterSpacing: -0.3 },
  ageStepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: 16 },
  stepperArrowBtn: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#111111', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#222222' },
  stepperArrowText: { color: '#FF6B00', fontSize: 20, fontWeight: '700' },
  activeAgeDisplayValue: { color: '#F8FAFC', fontSize: 32, fontWeight: '900', marginHorizontal: 36 },
  sliderValueMetricText: { color: '#FF6B00', fontSize: 24, fontWeight: '900', textAlign: 'center', marginVertical: 4 },
  nikeSliderTrack: { width: '100%', height: 40, marginBottom: 12 },
  formFooterRowBlock: { marginTop: 40, width: '100%', alignItems: 'center' },
  stepIndicatorLabelText: { color: '#64748B', fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 12, textTransform: 'uppercase' },
  genderChipRow: { flexDirection: 'column', marginBottom: 12 },
  premiumCustomCheckboxCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111111', padding: 16, borderRadius: 14, marginBottom: 10, borderWidth: 1, borderColor: '#222222' },
  checkboxCardActive: { borderColor: '#FF6B00', backgroundColor: '#160B02' },
  customCircleIndicatorCheck: { width: 18, height: 28, borderRadius: 9, borderWidth: 2, borderColor: '#475569', marginRight: 14 },
  circleIndicatorChecked: { borderColor: '#FF6B00', backgroundColor: '#FF6B00' },
  checkboxLabelText: { color: '#F8FAFC', fontSize: 15, fontWeight: '700' },
  splitSelectionColumnWrap: { flexDirection: 'column', gap: 8, marginBottom: 12 },
  splitSelectionRowChip: { backgroundColor: '#111111', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#222222' },
  splitSelectionRowChipActive: { borderColor: '#FF6B00', backgroundColor: '#160B02' },
  splitChipMainText: { color: '#94A3B8', fontSize: 14, fontWeight: '700' },
  splitChipMainTextActive: { color: '#F8FAFC' },
  dynamicSplitExplanationContainer: { backgroundColor: '#111111', padding: 14, borderRadius: 10, marginVertical: 8, borderWidth: 1, borderColor: '#222222' },
  explanationTextContent: { color: '#64748B', fontSize: 13, lineHeight: 18, fontWeight: '500' },
  header: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#111111' },
  headerLabel: { fontSize: 11, fontWeight: '800', color: '#FF6B00', letterSpacing: 1.5 },
  workoutTitle: { fontSize: 22, fontWeight: 'bold', color: '#F8FAFC', marginTop: 2 },
  customBtn: { backgroundColor: '#111111', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#222222' },
  customBtnText: { color: '#FF6B00', fontWeight: '700', fontSize: 13 },
  listContent: { padding: 16, paddingBottom: 100 },
  exerciseCard: { backgroundColor: '#111111', borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#222222' },
  exerciseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  exerciseName: { fontSize: 16, fontWeight: 'bold', color: '#F8FAFC', flex: 1 },
  muscleBadge: { fontSize: 11, fontWeight: '600', color: '#94A3B8', backgroundColor: '#222222', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 8 },
  setRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#000000', padding: 10, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: '#111111' },
  setRowCompleted: { borderColor: '#3A1D02', backgroundColor: '#160B02' },
  setNumberLabel: { fontSize: 13, fontWeight: '600', color: '#64748B', width: 45 },
  inputWrap: { flexDirection: 'row', alignItems: 'center' },
  numericInput: { backgroundColor: '#111111', color: '#F8FAFC', borderWidth: 1, borderColor: '#222222', borderRadius: 6, width: 50, paddingVertical: 4, paddingHorizontal: 8, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  inputUnit: { color: '#64748B', fontSize: 12, marginLeft: 6, width: 30 },
  checkSquare: { width: 28, height: 28, borderWidth: 2, borderColor: '#222222', borderRadius: 6, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111111' },
  checkSquareChecked: { borderColor: '#FF6B00', backgroundColor: '#FF6B00' },
  checkIcon: { color: '#000000', fontWeight: '900', fontSize: 16 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#000000', padding: 16, borderTopWidth: 1, borderTopColor: '#111111' },
  finishBtn: { backgroundColor: '#FF6B00', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  finishBtnText: { color: '#000000', fontWeight: '800', fontSize: 15 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.85)', justifyContent: 'center', padding: 20 },
  modalContainer: { backgroundColor: '#111111', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#222222' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#F8FAFC', marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#64748B', marginBottom: 6, marginTop: 12 },
  formInput: { backgroundColor: '#000000', color: '#F8FAFC', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#222222', fontSize: 14 },
  pickerAlternativeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 4 },
  pickerChip: { backgroundColor: '#111111', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#222222' },
  pickerChipActive: { backgroundColor: '#FF6B00', borderColor: '#FF6B00' },
  pickerChipText: { color: '#64748B', fontSize: 13, fontWeight: '600' },
  pickerChipTextActive: { color: '#000000', fontWeight: '800' },
  modalActionRow: { flexDirection: 'row', gap: 12, marginTop: 24, justifyContent: 'flex-end' },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10 },
  cancelBtnText: { color: '#64748B', fontWeight: '600' },
  saveBtn: { backgroundColor: '#FF6B00', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  saveBtnText: { color: '#000000', fontWeight: '700' }
});