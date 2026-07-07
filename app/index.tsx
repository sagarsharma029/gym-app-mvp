import Slider from '@react-native-community/slider';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { ActiveTrackedExercise, useUserStore } from '../src/services/store';

interface MasterExerciseRow {
  id: number;
  name: string;
  primary_muscle: string;
  sub_muscle: string;
  difficulty: number;
  gender: string;
  base_multiplier: number;
}

export default function WorkspaceDashboard() {
  const store = useUserStore();
  
  const [isSplashing, setIsSplashing] = useState<boolean>(true);
  const [onboardingStage, setOnboardingStage] = useState<'WELCOME' | 'STEP_1' | 'STEP_2'>('WELCOME');
  
  const [activeWorkoutName, setActiveWorkoutName] = useState<string>('Loading...');
  const [trackedExercises, setTrackedExercises] = useState<ActiveTrackedExercise[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  // Advanced Exercise Library Search States
  const [isAddModalVisible, setIsAddModalVisible] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedMuscleFilter, setSelectedMuscleFilter] = useState<string>('All');
  const [fullExerciseLibrary, setFullExerciseLibrary] = useState<MasterExerciseRow[]>([]);

  // Local Undo Notification States
  const [undoExerciseBuffer, setUndoExerciseBuffer] = useState<ActiveTrackedExercise | null>(null);
  const [undoIndexBuffer, setUndoIndexBuffer] = useState<number | null>(null);
  const [showUndoBanner, setShowUndoBanner] = useState<boolean>(false);
  const [undoTimeoutId, setUndoIndexTimeoutId] = useState<any | null>(null);

  // Custom Creation Modal Substates
  const [isCreateModalVisible, setIsCreateModalVisible] = useState<boolean>(false);
  const [newExerciseName, setNewExerciseName] = useState<string>('');
  const [newExerciseMuscle, setNewExerciseMuscle] = useState<string>('Chest');

  // Form Onboarding Values
  const [formAge, setFormAge] = useState<number>(22);
  const [formWeight, setFormWeight] = useState<number>(75);
  const [formHeight, setFormHeight] = useState<number>(175);
  const [formGender, setFormGender] = useState<'M' | 'F' | 'U'>('M');
  const [formExp, setFormExp] = useState<'Beginner' | 'Familiar' | 'Advanced'>('Beginner');
  const [formSplit, setFormSplit] = useState<'3_DAY' | '4_DAY' | '5_DAY' | 'CUSTOM'>('5_DAY');

  useEffect(() => {
    const timer = setTimeout(() => setIsSplashing(false), 500);
    async function bootTrackingEngine() {
      try {
        await initDatabase();
        if (store.isOnboarded) {
          await loadActiveSessionLayout();
          await fetchMasterLibraryRegistry();
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

  async function fetchMasterLibraryRegistry() {
    try {
      const db = await getDatabaseConnection();
      const rows = await db.getAllAsync<MasterExerciseRow>('SELECT id, name, primary_muscle, sub_muscle, difficulty, gender, base_multiplier FROM exercises ORDER BY name ASC;');
      setFullExerciseLibrary(rows);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadActiveSessionLayout() {
    const db = await getDatabaseConnection();
    const currentWorkout = await db.getFirstAsync<{ id: number; name: string }>(
      'SELECT id, name FROM workouts WHERE split_type = ? AND day_order = ?;',
      [store.activeSplit, store.currentWorkoutDayOrder]
    );

    setActiveWorkoutName(currentWorkout ? currentWorkout.name : (store.activeSplit === 'CUSTOM' ? 'Custom Split' : `${store.activeSplit.replace('_', ' ')} Split`));

    // 🌟 Check Zustand persistence layer cache first before loading a stock seed template row
    if (store.activeSessionCache && store.activeSessionCache.length > 0) {
      setTrackedExercises(store.activeSessionCache);
      return;
    }

    if (!currentWorkout) {
      setTrackedExercises([]);
      return;
    }

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
    store.updateActiveSessionCache(massagedExercises);
  }

  // Wraps updates to sync local edits back to persistent memory arrays immediately
  function updateStateAndCache(updated: ActiveTrackedExercise[]) {
    setTrackedExercises(updated);
    store.updateActiveSessionCache(updated);
  }

  const handleAddSet = (exerciseIndex: number) => {
    const updated = [...trackedExercises];
    const targetEx = updated[exerciseIndex];
    const newIndex = targetEx.sets.length;
    
    // Copy properties from preceding row defaults safely
    const baseWeight = newIndex > 0 ? targetEx.sets[newIndex - 1].weight : '20';
    const baseReps = newIndex > 0 ? targetEx.sets[newIndex - 1].reps : '10';

    targetEx.sets.push({
      id: `${targetEx.workout_exercise_id}_${Date.now()}`,
      weight: baseWeight,
      reps: baseReps,
      isCompleted: false
    });
    updateStateAndCache(updated);
  };

  const handleRemoveSet = (exerciseIndex: number) => {
    const updated = [...trackedExercises];
    const targetEx = updated[exerciseIndex];
    
    if (targetEx.sets.length > 1) {
      targetEx.sets.pop();
      updateStateAndCache(updated);
    } else {
      // 🌟 Trigger 3-second non-destructive countdown Undo Banner buffer sequence
      if (undoTimeoutId) clearTimeout(undoTimeoutId);
      
      setUndoExerciseBuffer(targetEx);
      setUndoIndexBuffer(exerciseIndex);
      setShowUndoBanner(true);

      const filtered = updated.filter((_, idx) => idx !== exerciseIndex);
      updateStateAndCache(filtered);

      const timeout = setTimeout(() => {
        setShowUndoBanner(false);
        setUndoExerciseBuffer(null);
        setUndoIndexBuffer(null);
      }, 3000);
      setUndoIndexTimeoutId(timeout);
    }
  };

  function triggerUndoExerciseRestoration() {
    if (undoExerciseBuffer === null || undoIndexBuffer === null) return;
    if (undoTimeoutId) clearTimeout(undoTimeoutId);

    const restored = [...trackedExercises];
    restored.splice(undoIndexBuffer, 0, undoExerciseBuffer);
    
    updateStateAndCache(restored);
    setShowUndoBanner(false);
    setUndoExerciseBuffer(null);
    setUndoIndexBuffer(null);
  }

  const toggleSetCompletion = (exerciseIndex: number, setIndex: number) => {
    const updated = [...trackedExercises];
    updated[exerciseIndex].sets[setIndex].isCompleted = !updated[exerciseIndex].sets[setIndex].isCompleted;
    updateStateAndCache(updated);
  };

  async function handleAddExerciseFromLibrary(ex: MasterExerciseRow) {
    const appendedExercise: ActiveTrackedExercise = {
      workout_exercise_id: Date.now(),
      exercise_id: ex.id,
      name: ex.name,
      primary_muscle: ex.primary_muscle,
      sub_muscle: ex.sub_muscle,
      difficulty: ex.difficulty,
      gender: ex.gender,
      base_multiplier: ex.base_multiplier,
      sets: [
        { id: `${Date.now()}_0`, weight: '20', reps: '10', isCompleted: false },
        { id: `${Date.now()}_1`, weight: '20', reps: '10', isCompleted: false },
        { id: `${Date.now()}_2`, weight: '20', reps: '10', isCompleted: false }
      ]
    };
    const updatedList = [...trackedExercises, appendedExercise];
    updateStateAndCache(updatedList);
    setIsAddModalVisible(false);
    alert(`${ex.name} Added!`);
  }

  async function handleCreateAndInsertCustomExercise() {
    if (!newExerciseName.trim()) return;
    try {
      const db = await getDatabaseConnection();
      await db.runAsync(
        'INSERT OR IGNORE INTO exercises (name, primary_muscle, sub_muscle, difficulty, gender, base_multiplier) VALUES (?, ?, ?, ?, ?, ?);',
        [newExerciseName.trim(), newExerciseMuscle, 'Custom Input', 1, 'U', 0.25]
      );
      await fetchMasterLibraryRegistry();
      
      const verifiedRow = await db.getFirstAsync<MasterExerciseRow>('SELECT id, name, primary_muscle, sub_muscle, difficulty, gender, base_multiplier FROM exercises WHERE name = ?;', [newExerciseName.trim()]);
      if (verifiedRow) {
        handleAddExerciseFromLibrary(verifiedRow);
      }
      setNewExerciseName('');
      setIsCreateModalVisible(false);
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

      const result = await db.runAsync(
        'INSERT INTO completed_workouts (workout_name, split_type, date_logged, total_sets_completed) VALUES (?, ?, ?, ?);',
        [activeWorkoutName, store.activeSplit, timestamp, totalSets]
      );

      const insertedWorkoutId = result.lastInsertRowId;

      for (const ex of trackedExercises) {
        const completedSets = ex.sets.filter(s => s.isCompleted);
        for (let i = 0; i < completedSets.length; i++) {
          await db.runAsync(
            'INSERT INTO completed_workout_sets (completed_workout_id, exercise_name, weight_logged, reps_logged, set_order) VALUES (?, ?, ?, ?, ?);',
            [insertedWorkoutId, ex.name, completedSets[i].weight, completedSets[i].reps, i + 1]
          );
        }
      }

      await db.runAsync(
        'INSERT OR REPLACE INTO calendar_logs (log_date, status_type, workout_session_id) VALUES (?, ?, ?);',
        [timestamp, 'WORKOUT', insertedWorkoutId]
      );

      alert('Workout Successfully Saved! 🏋️‍♂️');
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

  function getFormattedHeaderDate() {
    const today = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${days[today.getDay()]}, ${months[today.getMonth()]} ${today.getDate()}`;
  }

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
              onValueChange={(val) => setFormHeight(val)}
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
              onValueChange={(val) => setFormWeight(val)}
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
                { key: 'M', label: 'Male' },
                { key: 'F', label: 'Female' }
              ] as const).map(g => (
                <TouchableOpacity key={g.key} style={[styles.premiumCustomCheckboxCard, formGender === g.key && styles.checkboxCardActive]} onPress={() => setFormGender(g.key)}>
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
                <TouchableOpacity key={level.key} style={[styles.splitSelectionRowChip, formExp === level.key && styles.splitSelectionRowChipActive]} onPress={() => setFormExp(level.key)}>
                  <Text style={[styles.splitChipMainText, formExp === level.key && styles.splitChipMainTextActive]}>{level.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionQuestionTitle}>Workout split structure</Text>
            <View style={styles.splitSelectionColumnWrap}>
              {([
                { key: '3_DAY', label: '3 Day Split' },
                { key: '4_DAY', label: '4 Day Split' },
                { key: '5_DAY', label: '5 Day Split' },
                { key: 'CUSTOM', label: 'Custom Split' }
              ] as const).map(split => {
                const isActive = formSplit === split.key;
                return (
                  <TouchableOpacity key={split.key} style={[styles.splitSelectionRowChip, isActive && styles.splitSelectionRowChipActive]} onPress={() => setFormSplit(split.key)}>
                    <Text style={[styles.splitChipMainText, isActive && styles.splitChipMainTextActive]}>{split.label}</Text>
                    {isActive && (
                      <View style={styles.inlineExplanationWrapper}>
                        <Text style={styles.inlineExplanationText}>
                          {split.key === '3_DAY' && 'Alternating Push, Pull, Legs sequence loop. Excellent for baseline motor recovery paths.'}
                          {split.key === '4_DAY' && '4-Day strategic split targeting Chest/Triceps, Back, Shoulder/Biceps, and Legs sequentially.'}
                          {split.key === '5_DAY' && 'Premium Hypertrophy Bro-Split sequence targeting explicit standalone muscle groups daily.'}
                          {split.key === 'CUSTOM' && 'Be your own master. Select your own exercises and make your custom split.'}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.formFooterRowBlock}>
              <Text style={styles.stepIndicatorLabelText}>Step 2 of 2</Text>
              <TouchableOpacity style={styles.nikePrimaryBtn} onPress={runOnboardingSubmit}>
                <Text style={styles.nikePrimaryBtnText}>Let's Lift</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    );
  }

  // Filter exercises dynamically based on search string and muscle group selection chips
  const filteredLibrary = fullExerciseLibrary.filter(ex => {
    const matchesSearch = ex.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesMuscle = selectedMuscleFilter === 'All' || ex.primary_muscle === selectedMuscleFilter;
    return matchesSearch && matchesMuscle;
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerLabel}>{getFormattedHeaderDate()}</Text>
          <Text style={styles.workoutTitle}>{activeWorkoutName}</Text>
        </View>
        <TouchableOpacity style={styles.customBtn} onPress={() => setIsAddModalVisible(true)}>
          <Text style={styles.customBtnText}>+ Add Exercise</Text>
        </TouchableOpacity>
      </View>

      {/* 🌟 3-SECOND COUNTDOWN DISMISSAL UNDO ACTION BANNER */}
      {trackedExercises.length === 0 && (
        <View style={styles.emptyTrackerWarningState}>
          <Text style={styles.emptyTrackerWarningText}>No movements active. Click Add Exercise above.</Text>
        </View>
      )}

      <FlatList
        data={trackedExercises}
        keyExtractor={(item) => item.workout_exercise_id.toString()}
        contentContainerStyle={styles.listContent}
        renderItem={({ item: exercise, index: exIdx }) => (
          <View style={styles.exerciseCard}>
            <View style={styles.exerciseHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.exerciseName}>{exercise.name}</Text>
                <Text style={styles.subAnatomicalText}>{exercise.sub_muscle}</Text>
              </View>
              
              {/* Set Mutation Controls row overlay mapping */}
              <View style={styles.setsMutationRowButtonWrapper}>
                <TouchableOpacity style={styles.setCountCtrlBtn} onPress={() => handleRemoveSet(exIdx)}>
                  <Text style={styles.setCountCtrlBtnText}>-</Text>
                </TouchableOpacity>
                <Text style={styles.setsCounterValueDisplay}>{exercise.sets.length}</Text>
                <TouchableOpacity style={styles.setCountCtrlBtn} onPress={() => handleAddSet(exIdx)}>
                  <Text style={styles.setCountCtrlBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            {exercise.sets.map((set, setIdx) => (
              <View key={set.id} style={[styles.setRow, set.isCompleted && styles.setRowCompleted]}>
                <Text style={styles.setNumberLabel}>Set {setIdx + 1}</Text>
                <View style={styles.inputWrap}>
                  <TextInput 
                    style={styles.numericInput} 
                    value={set.weight} 
                    keyboardType="numeric" 
                    onChangeText={(txt) => {
                      const updated = [...trackedExercises];
                      updated[exIdx].sets[setIdx].weight = txt;
                      updateStateAndCache(updated);
                    }} 
                  />
                  <Text style={styles.inputUnit}>kg</Text>
                </View>

                <View style={styles.inputWrap}>
                  <TextInput 
                    style={styles.numericInput} 
                    value={set.reps} 
                    keyboardType="numeric" 
                    onChangeText={(txt) => {
                      const updated = [...trackedExercises];
                      updated[exIdx].sets[setIdx].reps = txt;
                      updateStateAndCache(updated);
                    }} 
                  />
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

      {/* Persistent Live Non-destructive Undo Notification Floating Bar component */}
      {showUndoBanner && (
        <View style={styles.undoNotificationBannerFloatingBlock}>
          <Text style={styles.undoTextDescriptionLabel}>Exercise removed</Text>
          <TouchableOpacity onPress={triggerUndoExerciseRestoration}>
            <Text style={styles.undoActionOrangeButtonText}>UNDO</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.footer}>
        <TouchableOpacity style={styles.finishBtn} onPress={handleFinishWorkoutSession}>
          <Text style={styles.finishBtnText}>Save Workout</Text>
        </TouchableOpacity>
      </View>

      {/* 📅 DYNAMIC SEARCH & MUSCLE CHIPS REGISTRY LIBRARY MODAL OVERLAY */}
      <Modal visible={isAddModalVisible} animationType="slide" transparent>
        <View style={styles.searchModalBackdrop}>
          <View style={styles.searchModalInnerContainer}>
            <View style={styles.searchModalTopBarHeader}>
              <Text style={styles.searchModalTitle}>Add Exercise</Text>
              <TouchableOpacity style={styles.newMovementTriggerBtn} onPress={() => setIsCreateModalVisible(true)}>
                <Text style={styles.newMovementTriggerBtnText}>+ New Exercise</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.searchBarInputField}
              placeholder="Search exercise registry..."
              placeholderTextColor="#64748B"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />

            {/* Premium Anatomical Scrollable Filter Chips row implementation */}
            <View style={{ height: 45, marginVertical: 4 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}>
                {['All', 'Chest', 'Back', 'Biceps', 'Triceps', 'Shoulder', 'Legs', 'Abs'].map(muscle => {
                  const isSel = selectedMuscleFilter === muscle;
                  return (
                    <TouchableOpacity key={muscle} style={[styles.muscleSelectFilterChip, isSel && styles.muscleSelectFilterChipActive]} onPress={() => setSelectedMuscleFilter(muscle)}>
                      <Text style={[styles.muscleSelectFilterChipText, isSel && styles.muscleSelectFilterChipTextActive]}>{muscle}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <FlatList
              data={filteredLibrary}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={{ paddingBottom: 20 }}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.exerciseLibraryOptionRow} onPress={() => handleAddExerciseFromLibrary(item)}>
                  <View>
                    <Text style={styles.libraryItemNameText}>{item.name}</Text>
                    <Text style={styles.libraryItemMuscleLabelText}>{item.primary_muscle} · {item.sub_muscle}</Text>
                  </View>
                  <Text style={styles.libraryItemAddPlusLabelText}>+</Text>
                </TouchableOpacity>
              )}
            />

            <TouchableOpacity style={styles.closeSearchModalBtn} onPress={() => setIsAddModalVisible(false)}>
              <Text style={styles.closeSearchModalBtnText}>Close Library</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* NESTED RAW CUSTOM CREATION SUBMODAL */}
      <Modal visible={isCreateModalVisible} transparent animationType="fade">
        <View style={styles.searchModalBackdrop}>
          <View style={styles.customCreationContainerPanel}>
            <Text style={styles.customCreationTitle}>Create Custom Exercise</Text>
            <Text style={styles.creationLabelFieldText}>Exercise Name</Text>
            <TextInput style={styles.formInputTextRowField} placeholder="e.g., Incline Dumbbell Hammer Curl" placeholderTextColor="#64748B" value={newExerciseName} onChangeText={setNewExerciseName} />

            <Text style={styles.creationLabelFieldText}>Primary Anatomical Group</Text>
            <View style={styles.creationMusclePickerRowWrap}>
              {['Chest', 'Back', 'Biceps', 'Triceps', 'Shoulder', 'Legs', 'Abs'].map(m => (
                <TouchableOpacity key={m} style={[styles.creationMuscleChipElement, newExerciseMuscle === m && styles.creationMuscleChipElementActive]} onPress={() => setNewExerciseMuscle(m)}>
                  <Text style={[styles.creationMuscleChipElementText, newExerciseMuscle === m && styles.creationMuscleChipElementTextActive]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.creationActionButtonsRowGroup}>
              <TouchableOpacity style={styles.creationCancelButton} onPress={() => setIsCreateModalVisible(false)}>
                <Text style={styles.creationCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.creationSaveButton} onPress={handleCreateAndInsertCustomExercise}>
                <Text style={styles.creationSaveButtonText}>Create Movement</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  genderChipRow: { flexDirection: 'column', gap: 8, marginBottom: 12 },
  premiumCustomCheckboxCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111111', padding: 16, borderRadius: 14, marginBottom: 10, borderWidth: 1, borderColor: '#222222' },
  checkboxCardActive: { borderColor: '#FF6B00', backgroundColor: '#160B02' },
  customCircleIndicatorCheck: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#475569', marginRight: 14 },
  circleIndicatorChecked: { borderColor: '#FF6B00', backgroundColor: '#FF6B00' },
  checkboxLabelText: { color: '#F8FAFC', fontSize: 15, fontWeight: '700' },
  splitSelectionColumnWrap: { flexDirection: 'column', gap: 8, marginBottom: 12 },
  splitSelectionRowChip: { backgroundColor: '#111111', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#222222' },
  splitSelectionRowChipActive: { borderColor: '#FF6B00', backgroundColor: '#160B02' },
  splitChipMainText: { color: '#94A3B8', fontSize: 14, fontWeight: '700' },
  splitChipMainTextActive: { color: '#F8FAFC' },
  inlineExplanationWrapper: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#222222' },
  inlineExplanationText: { color: '#64748B', fontSize: 13, lineHeight: 18, fontWeight: '500' },
  
  header: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#111111' },
  headerLabel: { fontSize: 11, fontWeight: '800', color: '#FF6B00', letterSpacing: 1.5, textTransform: 'uppercase' },
  workoutTitle: { fontSize: 22, fontWeight: 'bold', color: '#F8FAFC', marginTop: 2 },
  customBtn: { backgroundColor: '#111111', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#222222' },
  customBtnText: { color: '#FF6B00', fontWeight: '800', fontSize: 13 },
  emptyTrackerWarningState: { padding: 24, backgroundColor: '#111111', margin: 16, borderRadius: 12, borderWidth: 1, borderColor: '#222222' },
  emptyTrackerWarningText: { color: '#64748B', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  listContent: { padding: 16, paddingBottom: 120 },
  exerciseCard: { backgroundColor: '#111111', borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#222222' },
  exerciseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  exerciseName: { fontSize: 16, fontWeight: 'bold', color: '#F8FAFC', letterSpacing: -0.2 },
  subAnatomicalText: { color: '#64748B', fontSize: 12, fontWeight: '600', marginTop: 2 },
  setsMutationRowButtonWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#000000', borderRadius: 12, padding: 4, borderWidth: 1, borderColor: '#222222' },
  setCountCtrlBtn: { width: 28, height: 28, borderRadius: 6, backgroundColor: '#111111', justifyContent: 'center', alignItems: 'center' },
  setCountCtrlBtnText: { color: '#FF6B00', fontSize: 15, fontWeight: '800' },
  setsCounterValueDisplay: { color: '#F8FAFC', paddingHorizontal: 12, fontSize: 13, fontWeight: '800' },
  setRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#000000', padding: 10, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: '#111111' },
  setRowCompleted: { borderColor: '#3A1D02', backgroundColor: '#160B02' },
  setNumberLabel: { fontSize: 13, fontWeight: '600', color: '#64748B', width: 45 },
  inputWrap: { flexDirection: 'row', alignItems: 'center' },
  numericInput: { backgroundColor: '#111111', color: '#F8FAFC', borderWidth: 1, borderColor: '#222222', borderRadius: 6, width: 50, paddingVertical: 4, paddingHorizontal: 8, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  inputUnit: { color: '#64748B', fontSize: 12, marginLeft: 6, width: 30 },
  checkSquare: { width: 28, height: 28, borderWidth: 2, borderColor: '#222222', borderRadius: 6, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111111' },
  checkSquareChecked: { borderColor: '#FF6B00', backgroundColor: '#FF6B00' },
  checkIcon: { color: '#000000', fontWeight: '900', fontSize: 16 },
  
  undoNotificationBannerFloatingBlock: { position: 'absolute', bottom: 90, left: 16, right: 16, backgroundColor: '#1E293B', padding: 14, borderRadius: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#475569', zIndex: 999 },
  undoTextDescriptionLabel: { color: '#F8FAFC', fontSize: 14, fontWeight: '700' },
  undoActionOrangeButtonText: { color: '#FF6B00', fontSize: 14, fontWeight: '900', letterSpacing: 0.5 },
  
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#000000', padding: 16, borderTopWidth: 1, borderTopColor: '#111111' },
  finishBtn: { backgroundColor: '#FF6B00', paddingVertical: 14, borderRadius: 30, alignItems: 'center' },
  finishBtnText: { color: '#000000', fontWeight: '900', fontSize: 15, letterSpacing: 0.5 },
  
  searchModalBackdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.85)', justifyContent: 'flex-end' },
  searchModalInnerContainer: { backgroundColor: '#111111', borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '85%', padding: 20, borderWidth: 1, borderColor: '#222222' },
  searchModalTopBarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  searchModalTitle: { fontSize: 20, fontWeight: '900', color: '#F8FAFC' },
  newMovementTriggerBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: '#000000', borderWidth: 1, borderColor: '#222222' },
  newMovementTriggerBtnText: { color: '#FF6B00', fontSize: 12, fontWeight: '800' },
  searchBarInputField: { backgroundColor: '#000000', color: '#F8FAFC', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#222222', fontSize: 14, marginBottom: 8 },
  muscleSelectFilterChip: { backgroundColor: '#000000', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#222222', height: 36, justifyContent: 'center' },
  muscleSelectFilterChipActive: { backgroundColor: '#FF6B00', borderColor: '#FF6B00' },
  muscleSelectFilterChipText: { color: '#64748B', fontSize: 13, fontWeight: '700' },
  muscleSelectFilterChipTextActive: { color: '#000000', fontWeight: '900' },
  exerciseLibraryOptionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#000000', padding: 14, borderRadius: 12, marginTop: 8, borderWidth: 1, borderColor: '#222222' },
  libraryItemNameText: { color: '#F8FAFC', fontSize: 15, fontWeight: '700' },
  libraryItemMuscleLabelText: { color: '#64748B', fontSize: 12, fontWeight: '600', marginTop: 2 },
  libraryItemAddPlusLabelText: { color: '#FF6B00', fontSize: 18, fontWeight: '900' },
  closeSearchModalBtn: { backgroundColor: '#FFFFFF', paddingVertical: 14, borderRadius: 30, alignItems: 'center', marginTop: 10 },
  closeSearchModalBtnText: { color: '#000000', fontWeight: '900', fontSize: 14 },
  
  customCreationContainerPanel: { backgroundColor: '#111111', borderRadius: 20, padding: 20, margin: 16, width: '90%', alignSelf: 'center', borderColor: '#222222', borderWidth: 1 },
  customCreationTitle: { fontSize: 18, fontWeight: '900', color: '#F8FAFC', marginBottom: 14 },
  creationLabelFieldText: { color: '#64748B', fontSize: 12, fontWeight: '700', marginBottom: 6 },
  formInputTextRowField: { backgroundColor: '#000000', color: '#F8FAFC', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#222222', fontSize: 14, marginBottom: 14 },
  creationMusclePickerRowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 20 },
  creationMuscleChipElement: { backgroundColor: '#000000', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#222222' },
  creationMuscleChipElementActive: { backgroundColor: '#FF6B00', borderColor: '#FF6B00' },
  creationMuscleChipElementText: { color: '#64748B', fontSize: 12, fontWeight: '700' },
  creationMuscleChipElementTextActive: { color: '#000000', fontWeight: '900' },
  creationActionButtonsRowGroup: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end' },
  creationCancelButton: { padding: 10 },
  creationCancelButtonText: { color: '#64748B', fontWeight: '700' },
  creationSaveButton: { backgroundColor: '#FF6B00', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  creationSaveButtonText: { color: '#000000', fontWeight: '800' }
});