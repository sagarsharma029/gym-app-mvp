import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { logWorkoutCompletion } from '../src/services/db'; // Locked as clean top-level import
import { useUserStore } from '../src/services/store';
import { ActiveWorkoutData, fetchWorkoutBySequence } from '../src/services/workoutService';

interface PerformanceLogs {
  [exerciseId: number]: {
    setCount: number;
    completedSets: { [setIndex: number]: boolean };
    actualReps: { [setIndex: number]: string };
    actualWeight: { [setIndex: number]: string };
  };
}

type RecordMapping = { [key: number]: string };

export default function TodayScreen() {
  const { isOnboarded, currentSequenceOrder, completeOnboarding, advanceToNextWorkout } = useUserStore();
  
  // Onboarding states
  const [step, setStep] = useState<number>(1);
  const [tempLevel, setTempLevel] = useState<'beginner' | 'intermediate' | null>(null);

  // Active workout data states
  const [workoutData, setWorkoutData] = useState<ActiveWorkoutData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [sessionLogs, setSessionLogs] = useState<PerformanceLogs>({});

  // Rest Timer Local States
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isTimerActive, setIsTimerActive] = useState<boolean>(false);

  // Database reader initialization hook
  useEffect(() => {
    if (isOnboarded) {
      setIsLoading(true);
      fetchWorkoutBySequence(currentSequenceOrder)
        .then((data) => {
          setWorkoutData(data);
          
          if (data?.exercises) {
            const initialLogs: PerformanceLogs = {};
            data.exercises.forEach((ex) => {
              const initialReps = Array.from({ length: ex.default_sets }).reduce<RecordMapping>(
                (acc, _, i) => { acc[i] = ex.default_reps.toString(); return acc; }, {}
              );
              
              const initialWeight = Array.from({ length: ex.default_sets }).reduce<RecordMapping>(
                (acc, _, i) => { acc[i] = ex.suggested_weight.toString(); return acc; }, {}
              );

              initialLogs[ex.id] = {
                setCount: ex.default_sets,
                completedSets: {},
                actualReps: initialReps,
                actualWeight: initialWeight,
              };
            });
            setSessionLogs(initialLogs);
          }
        })
        .catch((err) => console.error("Error loading SQLite queue:", err))
        .finally(() => setIsLoading(false));
    }
  }, [isOnboarded, currentSequenceOrder]);

  // Timer Countdown Core Loop
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    if (isTimerActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((time) => time - 1);
      }, 1000);
    } else if (timeLeft === 0 && isTimerActive) {
      setIsTimerActive(false);
      Alert.alert("Rest Over!", "Time to hit your next set!");
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerActive, timeLeft]);

  // Start manual 2-minute timer action (120 seconds)
  const triggerRestTimer = () => {
    setTimeLeft(120);
    setIsTimerActive(true);
  };

  // Stop / Skip timer utility
  const cancelRestTimer = () => {
    setTimeLeft(0);
    setIsTimerActive(false);
  };

  // Format elapsed raw numbers to clean clock layout string (MM:SS)
  const renderFormattedClock = () => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  // Dynamic set handlers
  const addSetToExercise = (exerciseId: number, defaultReps: number, suggestedWeight: number) => {
    setSessionLogs((prev) => {
      const currentEx = prev[exerciseId];
      if (!currentEx) return prev;
      const nextIndex = currentEx.setCount;
      return {
        ...prev,
        [exerciseId]: {
          ...currentEx,
          setCount: currentEx.setCount + 1,
          actualReps: { ...currentEx.actualReps, [nextIndex]: defaultReps.toString() },
          actualWeight: { ...currentEx.actualWeight, [nextIndex]: suggestedWeight.toString() },
        }
      };
    });
  };

  const removeSetFromExercise = (exerciseId: number) => {
    setSessionLogs((prev) => {
      const currentEx = prev[exerciseId];
      if (!currentEx || currentEx.setCount <= 1) return prev;
      
      const targetIndex = currentEx.setCount - 1;
      const updatedSets = { ...currentEx.completedSets };
      const updatedReps = { ...currentEx.actualReps };
      const updatedWeight = { ...currentEx.actualWeight };
      
      delete updatedSets[targetIndex];
      delete updatedReps[targetIndex];
      delete updatedWeight[targetIndex];

      return {
        ...prev,
        [exerciseId]: {
          ...currentEx,
          setCount: currentEx.setCount - 1,
          completedSets: updatedSets,
          actualReps: updatedReps,
          actualWeight: updatedWeight,
        }
      };
    });
  };

  const toggleSetComplete = (exerciseId: number, setIndex: number) => {
    const currentEx = sessionLogs[exerciseId];
    if (!currentEx) return;
    const wasCompleted = currentEx.completedSets[setIndex];
    
    setSessionLogs((prev) => {
      const ex = prev[exerciseId];
      if (!ex) return prev;
      const updatedSets = { ...ex.completedSets, [setIndex]: !ex.completedSets[setIndex] };
      return {
        ...prev,
        [exerciseId]: { ...ex, completedSets: updatedSets },
      };
    });

    if (!wasCompleted) {
      triggerRestTimer();
    }
  };

  const updatePerformanceMetrics = (exerciseId: number, setIndex: number, field: 'reps' | 'weight', value: string) => {
    setSessionLogs((prev) => {
      const currentEx = prev[exerciseId];
      if (!currentEx) return prev;
      if (field === 'reps') {
        const updatedReps = { ...currentEx.actualReps, [setIndex]: value };
        return { ...prev, [exerciseId]: { ...currentEx, actualReps: updatedReps } };
      } else {
        const updatedWeight = { ...currentEx.actualWeight, [setIndex]: value };
        return { ...prev, [exerciseId]: { ...currentEx, actualWeight: updatedWeight } };
      }
    });
  };

  const handleFinishWorkout = () => {
    if (!workoutData) return;

    let totalCompletedSets = 0;
    Object.values(sessionLogs).forEach((log) => {
      totalCompletedSets += Object.values(log.completedSets).filter(Boolean).length;
    });

    logWorkoutCompletion(workoutData.workout.name, totalCompletedSets)
      .then(() => {
        Alert.alert(
          "Workout Complete!",
          `Awesome job! You finished "${workoutData.workout.name}" and logged ${totalCompletedSets} total sets. Moving to next routine in your queue.`,
          [
            {
              text: "Done",
              onPress: () => {
                cancelRestTimer();
                advanceToNextWorkout();
                setSessionLogs({});
              }
            }
          ]
        );
      })
      .catch((err: any) => console.error("Failed to save history:", err));
  };

  const handleSelectLevel = (level: 'beginner' | 'intermediate') => {
    setTempLevel(level);
    setStep(2);
  };

  const handleSelectSplit = (days: number) => {
    if (!tempLevel) return;
    completeOnboarding(tempLevel, days);
  };

  if (!isOnboarded) {
    return (
      <View style={styles.container}>
        {step === 1 ? (
          <View style={styles.card}>
            <Text style={styles.title}>Welcome to Your Gym MVP</Text>
            <Text style={styles.subtitle}>Select your current lifting experience to get started:</Text>
            <TouchableOpacity style={styles.button} onPress={() => handleSelectLevel('beginner')}>
              <Text style={styles.buttonText}>Beginner (0-4 months)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={() => handleSelectLevel('intermediate')}>
              <Text style={styles.buttonText}>Familiar / Returning</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.title}>Choose Your Routine</Text>
            <Text style={styles.subtitle}>How many days per week do you intend to rotate through sequentially?</Text>
            <TouchableOpacity style={styles.button} onPress={() => handleSelectSplit(3)}>
              <Text style={styles.buttonText}>3-Day Split (Push / Pull / Legs)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={() => handleSelectSplit(4)}>
              <Text style={styles.buttonText}>4-Day Upper / Lower Split</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.backButton} onPress={() => setStep(1)}>
              <Text style={styles.backButtonText}>← Go Back</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.dashboardContainer}>
      <View style={styles.headerBlock}>
        <Text style={styles.queueLabel}>UP NEXT IN QUEUE</Text>
        <Text style={styles.workoutTitle}>{workoutData?.workout.name || 'Rest Day / Walk'}</Text>
      </View>

      <FlatList
        data={workoutData?.exercises || []}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        renderItem={({ item: exercise }) => {
          const exLog = sessionLogs[exercise.id];
          const currentSetCount = exLog ? exLog.setCount : exercise.default_sets;
          
          return (
            <View style={styles.exerciseCard}>
              <View style={styles.exerciseHeader}>
                <View style={styles.headerInfo}>
                  <Text style={styles.exerciseName}>{exercise.name}</Text>
                  <Text style={styles.targetLabel}>Target: {exercise.default_sets}×{exercise.default_reps} ({exercise.suggested_weight}kg)</Text>
                </View>
                
                <View style={styles.controlGroup}>
                  <TouchableOpacity style={styles.modifierButton} onPress={() => removeSetFromExercise(exercise.id)}>
                    <Text style={styles.modifierText}>−</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.modifierButton} onPress={() => addSetToExercise(exercise.id, exercise.default_reps, exercise.suggested_weight)}>
                    <Text style={styles.modifierText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {Array.from({ length: currentSetCount }).map((_, index) => {
                const isCompleted = exLog?.completedSets[index] || false;
                
                return (
                  <View key={index} style={[styles.setRow, isCompleted && styles.setRowCompleted]}>
                    <Text style={styles.setNumber}>SET {index + 1}</Text>
                    
                    <View style={styles.inputGroup}>
                      <TextInput
                        style={styles.logInput}
                        keyboardType="numeric"
                        value={exLog?.actualWeight?.[index] || ''}
                        onChangeText={(val) => updatePerformanceMetrics(exercise.id, index, 'weight', val)}
                        editable={!isCompleted}
                      />
                      <Text style={styles.unitText}>kg</Text>
                    </View>

                    <View style={styles.inputGroup}>
                      <TextInput
                        style={styles.logInput}
                        keyboardType="numeric"
                        value={exLog?.actualReps?.[index] || ''}
                        onChangeText={(val) => updatePerformanceMetrics(exercise.id, index, 'reps', val)}
                        editable={!isCompleted}
                      />
                      <Text style={styles.unitText}>reps</Text>
                    </View>

                    <TouchableOpacity 
                      style={[styles.checkbox, isCompleted && styles.checkboxChecked]} 
                      onPress={() => toggleSetComplete(exercise.id, index)}
                    >
                      <Text style={styles.checkboxText}>{isCompleted ? '✓' : ''}</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          );
        }}
        ListFooterComponent={
          <TouchableOpacity style={styles.finishWorkoutButton} onPress={handleFinishWorkout}>
            <Text style={styles.finishWorkoutText}>Finish Workout Session</Text>
          </TouchableOpacity>
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>No exercises populated for this routine day.</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  dashboardContainer: {
    flex: 1,
    backgroundColor: '#1C1C1E',
  },
  headerBlock: {
    backgroundColor: '#121212',
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  queueLabel: {
    color: '#007AFF',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  workoutTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
  },
  timerLauncher: {
    backgroundColor: '#3A3A3C',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  timerLauncherText: {
    color: '#007AFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  timerBannerActive: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  timerActiveText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  listContent: {
    padding: 16,
  },
  exerciseCard: {
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#3A3A3C',
    paddingBottom: 8,
  },
  headerInfo: {
    flexDirection: 'column',
    flex: 1,
  },
  exerciseName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  targetLabel: {
    color: '#8E8E93',
    fontSize: 12,
    marginTop: 2,
  },
  controlGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modifierButton: {
    backgroundColor: '#3A3A3C',
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  modifierText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1C1C1E',
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  setRowCompleted: {
    opacity: 0.5,
    backgroundColor: '#121212',
  },
  setNumber: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: 'bold',
    width: 45,
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2C2C2E',
    borderRadius: 6,
    paddingHorizontal: 6,
  },
  logInput: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    width: 40,
    paddingVertical: 4,
  },
  unitText: {
    color: '#8E8E93',
    fontSize: 11,
    marginLeft: 2,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#30D158',
    borderColor: '#30D158',
  },
  checkboxText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  finishWorkoutButton: {
    backgroundColor: '#30D158',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 32,
  },
  finishWorkoutText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  card: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  button: {
    width: '100%',
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  secondaryButton: {
    backgroundColor: '#3A3A3C',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    marginTop: 16,
    padding: 8,
  },
  backButtonText: {
    color: '#8E8E93',
    fontSize: 14,
  },
  emptyText: {
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 40,
  },
});