import React from 'react';
import type { AnalysisResponse, RecommendationResponse, FoodItem, ExerciseInfo } from '../services/api';

interface ResultPdfTemplateProps {
  userInfo?: {
    name: string | null;
    age: number | null;
    gender: string | null;
  };
  preferences?: {
    goal: string;
    activityLevel: string;
    exerciseComplexity: string;
    exerciseType: string;
  };
  somatotype: AnalysisResponse['somatotype'];
  measurements: AnalysisResponse['proxy_measurements'];
  recommendation: RecommendationResponse | null;
}

const SKINFOLD_KEYS = ['Triceps_Skinfold', 'Subscapular_Skinfold', 'Supraspinale_Skinfold', 'Calf_Skinfold'];
const BREADTH_KEYS = ['Humerus_Breadth', 'Femur_Breadth'];
const GIRTH_KEYS = ['Arm_Circumference_Flexed', 'Calf_Circumference'];

const styles = {
  container: {
    backgroundColor: '#ffffff',
    color: '#000000',
    width: '210mm',
    fontSize: '14px',
    fontFamily: 'Arial, sans-serif',
    boxSizing: 'border-box' as const,
  },
  page: {
    padding: '32px',
    minHeight: '297mm',
    boxSizing: 'border-box' as const,
  },
  page2: {
    padding: '32px',
    paddingTop: '48px',
    minHeight: '297mm',
    boxSizing: 'border-box' as const,
  },
  header: {
    textAlign: 'center' as const,
    marginBottom: '32px',
    borderBottom: '2px solid #000',
    paddingBottom: '16px',
  },
  title: {
    fontSize: '28px',
    fontWeight: 'bold',
    textTransform: 'uppercase' as const,
    letterSpacing: '2px',
    marginBottom: '8px',
    margin: 0,
  },
  subtitle: {
    color: '#666666',
    margin: 0,
    fontSize: '14px',
  },
  section: {
    marginBottom: '24px',
    pageBreakInside: 'avoid' as const,
  },
  lastSectionPage1: {
    marginBottom: '0px',
    paddingBottom: '0px',
    pageBreakInside: 'avoid' as const,
  },
  pageBreak: {
    pageBreakBefore: 'always' as const,
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    textTransform: 'uppercase' as const,
    marginBottom: '12px',
    borderBottom: '1px solid #cccccc',
    paddingBottom: '8px',
    margin: 0,
  },
  table: {
    width: '100%',
    textAlign: 'left' as const,
    borderCollapse: 'collapse' as const,
    fontSize: '13px',
  },
  tableRow: {
    borderBottom: '1px solid #f0f0f0',
  },
  tableCell: {
    padding: '6px 0',
  },
  tableCellBold: {
    padding: '6px 0',
    fontWeight: 600,
    width: '33%',
  },
  tableCellRight: {
    padding: '6px 0',
    textAlign: 'right' as const,
  },
  tableHeader: {
    backgroundColor: '#f0f0f0',
  },
  tableHeaderCell: {
    padding: '6px 8px',
    fontWeight: 'bold',
    fontSize: '13px',
  },
  tableDataCell: {
    padding: '6px 8px',
    fontSize: '13px',
  },
  gridContainer: {
    display: 'flex',
    gap: '16px',
  },
  gridHalf: {
    flex: 1,
  },
  gridThird: {
    flex: 1,
    minWidth: 0,
  },
  somatotypeValue: {
    fontWeight: 'bold',
    fontSize: '22px',
    display: 'block',
  },
  somatotypeDetail: {
    color: '#666666',
    fontSize: '14px',
  },
  subTitle: {
    fontWeight: 'bold',
    marginBottom: '6px',
    fontSize: '14px',
  },
  list: {
    margin: 0,
    paddingLeft: '20px',
    color: '#555555',
    fontSize: '13px',
  },
  card: {
    border: '1px solid #e0e0e0',
    padding: '10px',
    borderRadius: '4px',
    marginBottom: '8px',
    pageBreakInside: 'avoid' as const,
  },
  cardTitle: {
    fontWeight: 600,
    textTransform: 'capitalize' as const,
    fontSize: '13px',
    marginBottom: '6px',
  },
  cardList: {
    fontSize: '12px',
    color: '#666666',
    margin: 0,
    padding: 0,
    listStyle: 'none',
  },
  mealsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px',
  },
  exercisesGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: '8px',
  },
  measurementSubsection: {
    marginTop: '12px',
  },
  measurementSubtitle: {
    fontSize: '14px',
    fontWeight: 600,
    marginBottom: '6px',
    color: '#333',
  },
};

export const ResultPdfTemplate = React.forwardRef<HTMLDivElement, ResultPdfTemplateProps>(
  ({ userInfo, preferences, somatotype, measurements, recommendation }, ref) => {
    const today = new Date().toLocaleDateString();

    const formatKey = (key: string) => {
      const keyMap: Record<string, string> = {
        'Arm_Circumference_Flexed': 'Flexed Arm Girth',
        'Calf_Circumference': 'Calf Girth',
      };
      if (keyMap[key]) return keyMap[key];
      return key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim();
    };

    return (
      <div ref={ref} style={styles.container}>
        {/* Page 1 */}
        <div style={styles.page}>
          <div style={styles.header}>
            <h1 style={styles.title}>SomaLens Analysis Report</h1>
            <p style={styles.subtitle}>Generated on {today}</p>
          </div>

          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>User Profile</h2>
          <table style={styles.table}>
            <tbody>
              {userInfo && (
                <>
                  <tr style={styles.tableRow}>
                    <td style={styles.tableCellBold}>Name</td>
                    <td style={styles.tableCell}>{userInfo.name || 'N/A'}</td>
                  </tr>
                  <tr style={styles.tableRow}>
                    <td style={styles.tableCellBold}>Age</td>
                    <td style={styles.tableCell}>{userInfo.age ? `${userInfo.age} years` : 'N/A'}</td>
                  </tr>
                  <tr style={styles.tableRow}>
                    <td style={styles.tableCellBold}>Gender</td>
                    <td style={{...styles.tableCell, textTransform: 'capitalize'}}>{userInfo.gender || 'N/A'}</td>
                  </tr>
                </>
              )}
              {preferences && (
                <>
                  <tr style={styles.tableRow}>
                    <td style={styles.tableCellBold}>Goal</td>
                    <td style={{...styles.tableCell, textTransform: 'capitalize'}}>{preferences.goal.replace('_', ' ')}</td>
                  </tr>
                  <tr style={styles.tableRow}>
                    <td style={styles.tableCellBold}>Activity Level</td>
                    <td style={{...styles.tableCell, textTransform: 'capitalize'}}>{preferences.activityLevel}</td>
                  </tr>
                  <tr style={styles.tableRow}>
                    <td style={styles.tableCellBold}>Exercise Level</td>
                    <td style={{...styles.tableCell, textTransform: 'capitalize'}}>{preferences.exerciseComplexity}</td>
                  </tr>
                  <tr style={styles.tableRow}>
                    <td style={styles.tableCellBold}>Exercise Type</td>
                    <td style={{...styles.tableCell, textTransform: 'capitalize'}}>{preferences.exerciseType}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>

        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Somatotype Classification</h2>
          <div>
            <span style={styles.somatotypeValue}>{somatotype.classification}</span>
            <span style={styles.somatotypeDetail}>
              {somatotype.endomorphy.toFixed(1)} (Endo) - {somatotype.mesomorphy.toFixed(1)} (Meso) - {somatotype.ectomorphy.toFixed(1)} (Ecto)
            </span>
          </div>
        </div>

        <div style={styles.lastSectionPage1}>
          <h2 style={styles.sectionTitle}>Body Measurements</h2>
          
          {/* Basic Measurements */}
          <div style={styles.gridContainer}>
            <table style={{...styles.table, ...styles.gridHalf}}>
              <tbody>
                <tr style={styles.tableRow}>
                  <td style={styles.tableCellBold}>Height</td>
                  <td style={styles.tableCellRight}>{measurements.Stature?.toFixed(1) || '-'} cm</td>
                </tr>
                <tr style={styles.tableRow}>
                  <td style={styles.tableCellBold}>Weight</td>
                  <td style={styles.tableCellRight}>{measurements.Weight?.toFixed(1) || '-'} kg</td>
                </tr>
                <tr style={styles.tableRow}>
                  <td style={styles.tableCellBold}>Body Fat %</td>
                  <td style={styles.tableCellRight}>{measurements.Body_Fat_Percentage?.toFixed(1) || '-'}%</td>
                </tr>
              </tbody>
            </table>
            <table style={{...styles.table, ...styles.gridHalf}}>
              <tbody>
                {GIRTH_KEYS.map(key => (
                  <tr key={key} style={styles.tableRow}>
                    <td style={styles.tableCellBold}>{formatKey(key)}</td>
                    <td style={styles.tableCellRight}>{typeof measurements[key] === 'number' ? measurements[key].toFixed(1) : '-'} cm</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Skinfolds */}
          <div style={styles.measurementSubsection}>
            <h3 style={styles.measurementSubtitle}>Skinfolds (mm)</h3>
            <div style={styles.gridContainer}>
              <table style={{...styles.table, ...styles.gridHalf}}>
                <tbody>
                  {SKINFOLD_KEYS.slice(0, 2).map(key => (
                    <tr key={key} style={styles.tableRow}>
                      <td style={styles.tableCellBold}>{formatKey(key).replace(' Skinfold', '')}</td>
                      <td style={styles.tableCellRight}>{typeof measurements[key] === 'number' ? measurements[key].toFixed(1) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <table style={{...styles.table, ...styles.gridHalf}}>
                <tbody>
                  {SKINFOLD_KEYS.slice(2).map(key => (
                    <tr key={key} style={styles.tableRow}>
                      <td style={styles.tableCellBold}>{formatKey(key).replace(' Skinfold', '')}</td>
                      <td style={styles.tableCellRight}>{typeof measurements[key] === 'number' ? measurements[key].toFixed(1) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Breadths */}
          <div style={styles.measurementSubsection}>
            <h3 style={styles.measurementSubtitle}>Breadths (cm)</h3>
            <div style={styles.gridContainer}>
              <table style={{...styles.table, ...styles.gridHalf}}>
                <tbody>
                  {BREADTH_KEYS.map(key => (
                    <tr key={key} style={styles.tableRow}>
                      <td style={styles.tableCellBold}>{formatKey(key).replace(' Breadth', '')}</td>
                      <td style={styles.tableCellRight}>{typeof measurements[key] === 'number' ? measurements[key].toFixed(1) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        </div>

        {/* Page 2 */}
        {recommendation && (
          <>
          <div style={styles.page2}>
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>Nutrition Strategy</h2>
              
              <table style={{...styles.table, marginBottom: '16px'}}>
                <thead>
                  <tr style={styles.tableHeader}>
                    <th style={styles.tableHeaderCell}>Calories</th>
                    <th style={styles.tableHeaderCell}>Protein</th>
                    <th style={styles.tableHeaderCell}>Carbs</th>
                    <th style={styles.tableHeaderCell}>Fats</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={styles.tableDataCell}>{recommendation.ter?.toLocaleString()} kcal</td>
                    <td style={styles.tableDataCell}>{recommendation.macros?.protein_g}g ({recommendation.macros?.protein_pct}%)</td>
                    <td style={styles.tableDataCell}>{recommendation.macros?.carbs_g}g ({recommendation.macros?.carbs_pct}%)</td>
                    <td style={styles.tableDataCell}>{recommendation.macros?.fats_g}g ({recommendation.macros?.fats_pct}%)</td>
                  </tr>
                </tbody>
              </table>

              {recommendation.diet_principles && (
                <div style={{marginBottom: '16px'}}>
                  <h3 style={styles.subTitle}>Principles:</h3>
                  <ul style={styles.list}>
                    {recommendation.diet_principles.split('|').map((item, i) => (
                      <li key={i}>{item.trim()}</li>
                    ))}
                  </ul>
                </div>
              )}

              {recommendation.meals && (
                <div>
                  <h3 style={styles.subTitle}>Recommended Foods:</h3>
                  <div style={styles.mealsGrid}>
                    {Object.entries(recommendation.meals).map(([meal, foods]) => (
                      <div key={meal} style={styles.card}>
                        <h4 style={styles.cardTitle}>{meal}</h4>
                        <ul style={styles.cardList}>
                          {foods.map((food: FoodItem, i: number) => (
                            <li key={i}>• {food.name}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Page 3 */}
          <div style={styles.page2}>
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>Fitness Plan</h2>
              
              {recommendation.fitness_strategy && (
                <div style={{marginBottom: '16px'}}>
                  <h3 style={styles.subTitle}>Strategy:</h3>
                  <ul style={styles.list}>
                    {recommendation.fitness_strategy.split('|').map((item, i) => (
                      <li key={i}>{item.trim()}</li>
                    ))}
                  </ul>
                </div>
              )}

              <h3 style={styles.subTitle}>Recommended Exercises:</h3>
              {recommendation.exercises_ppl ? (
                <div style={styles.exercisesGrid}>
                  {(['push', 'pull', 'legs'] as const).map(type => (
                    recommendation.exercises_ppl![type]?.length > 0 && (
                      <div key={type} style={styles.card}>
                        <h4 style={styles.cardTitle}>{type} Day</h4>
                        <ul style={styles.cardList}>
                          {recommendation.exercises_ppl![type].map((ex: ExerciseInfo, i: number) => (
                            <li key={i}>• {ex.name}</li>
                          ))}
                        </ul>
                      </div>
                    )
                  ))}
                </div>
              ) : (
                recommendation.exercises && (
                  <div style={styles.card}>
                    <h4 style={styles.cardTitle}>Workout Routine</h4>
                    <ul style={{...styles.cardList, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px'}}>
                      {recommendation.exercises.map((ex, i) => (
                        <li key={i}>• {ex.name}</li>
                      ))}
                    </ul>
                  </div>
                )
              )}
            </div>
          </div>
          </>
        )}
      </div>
    );
  }
);

ResultPdfTemplate.displayName = 'ResultPdfTemplate';
