/**
 * Astronomical Calculation Utilities
 * 
 * Provides accurate astronomical calculations for calendar conversions.
 * Based on algorithms from:
 * - "Astronomical Algorithms" by Jean Meeus
 * - "Calendrical Calculations" by Dershowitz & Reingold
 * 
 * These calculations are essential for culturally accurate calendar implementations,
 * particularly for calendars that depend on astronomical events like:
 * - Vernal equinox (Baha'i calendar)
 * - New moons (Chinese calendar)
 * - Solar terms (Chinese calendar)
 */

import { gregorianToJDN, jdnToGregorian } from './julianDayUtils';

/**
 * Calculate the number of Julian centuries since J2000.0 (January 1, 2000, 12:00 UTC)
 * @param jdn Julian Day Number
 * @returns Julian centuries since J2000.0
 */
function julianCenturiesSinceJ2000(jdn: number): number {
  // J2000.0 = JDN 2451545.0
  const daysSinceJ2000 = jdn - 2451545.0;
  return daysSinceJ2000 / 36525.0;
}

/**
 * Calculate the mean solar longitude (L) in degrees
 * @param T Julian centuries since J2000.0
 * @returns Mean solar longitude in degrees (0-360)
 */
function meanSolarLongitude(T: number): number {
  // Formula from Meeus, "Astronomical Algorithms", Chapter 25
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  return L0 % 360;
}

/**
 * Calculate the mean anomaly of the Sun (M) in degrees
 * @param T Julian centuries since J2000.0
 * @returns Mean anomaly in degrees (0-360)
 */
function meanSolarAnomaly(T: number): number {
  // Formula from Meeus, "Astronomical Algorithms", Chapter 25
  const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
  return M % 360;
}

/**
 * Calculate the equation of center for the Sun (C) in degrees
 * @param M Mean solar anomaly in degrees
 * @param T Julian centuries since J2000.0
 * @returns Equation of center in degrees
 */
function solarEquationOfCenter(M: number, T: number): number {
  const M_rad = (M * Math.PI) / 180;
  // Formula from Meeus, "Astronomical Algorithms", Chapter 25
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M_rad) +
            (0.019993 - 0.000101 * T) * Math.sin(2 * M_rad) +
            0.000289 * Math.sin(3 * M_rad);
  return C;
}

/**
 * Calculate the true solar longitude (λ) in degrees
 * @param jdn Julian Day Number
 * @returns True solar longitude in degrees (0-360)
 */
export function trueSolarLongitude(jdn: number): number {
  const T = julianCenturiesSinceJ2000(jdn);
  const L0 = meanSolarLongitude(T);
  const M = meanSolarAnomaly(T);
  const C = solarEquationOfCenter(M, T);
  const λ = L0 + C;
  return ((λ % 360) + 360) % 360; // Normalize to 0-360
}

/**
 * Calculate the date of the vernal equinox (March equinox) for a given year
 * The vernal equinox occurs when the Sun's true longitude is 0°
 * 
 * Algorithm based on Meeus, "Astronomical Algorithms", Chapter 27
 * Uses iterative refinement to find when solar longitude equals 0°
 * 
 * @param year Gregorian year
 * @returns Julian Day Number of the vernal equinox
 */
export function vernalEquinoxJDN(year: number): number {
  // Approximate date of vernal equinox: around March 20-21
  // Start with March 20 at noon (12:00 UTC)
  let jdn = gregorianToJDN(year, 3, 20) + 0.5;
  
  // Refine the date by finding when solar longitude equals 0°
  // Use Newton's method for iterative refinement
  for (let i = 0; i < 5; i++) {
    const longitude = trueSolarLongitude(jdn);
    
    // If longitude is very close to 0°, we're done
    if (Math.abs(longitude) < 0.01 || Math.abs(longitude - 360) < 0.01) {
      break;
    }
    
    // Calculate the rate of change of solar longitude (degrees per day)
    // Approximate as the difference over 1 day
    const longitude1 = trueSolarLongitude(jdn + 1);
    const rateOfChange = (longitude1 - longitude + 360) % 360;
    
    // Adjust jdn based on how far we are from 0°
    // Normalize longitude: if > 180°, treat as negative
    const normalizedLongitude = longitude > 180 ? longitude - 360 : longitude;
    const adjustment = -normalizedLongitude / rateOfChange;
    
    jdn += adjustment;
    
    // Prevent infinite loops
    if (Math.abs(adjustment) < 0.0001) {
      break;
    }
  }
  
  // Return the integer JDN (equinox occurs at some time during this day)
  // In practice, we round to the nearest day
  return Math.round(jdn);
}

/**
 * Calculate the mean lunar longitude
 * Based on Meeus, "Astronomical Algorithms", Chapter 47
 * @param T Julian centuries since J2000.0
 * @returns Mean lunar longitude in degrees (0-360)
 */
function meanLunarLongitude(T: number): number {
  // Formula from Meeus, "Astronomical Algorithms", Chapter 47
  const L = 218.3164477 + 481267.88123421 * T - 0.0015786 * T * T + 
            T * T * T / 538841 - T * T * T * T / 65194000;
  return ((L % 360) + 360) % 360; // Normalize to 0-360
}

/**
 * Calculate the mean lunar anomaly
 * @param T Julian centuries since J2000.0
 * @returns Mean lunar anomaly in degrees (0-360)
 */
function meanLunarAnomaly(T: number): number {
  // Formula from Meeus, "Astronomical Algorithms", Chapter 47
  const M = 134.9633964 + 477198.8675055 * T + 0.0087414 * T * T + 
            T * T * T / 69699 - T * T * T * T / 14712000;
  return ((M % 360) + 360) % 360; // Normalize to 0-360
}

/**
 * Calculate the lunar elongation (distance from Sun)
 * @param T Julian centuries since J2000.0
 * @returns Lunar elongation in degrees (0-360)
 */
function lunarElongation(T: number): number {
  // Formula from Meeus, "Astronomical Algorithms", Chapter 47
  const D = 297.8501921 + 445267.1114034 * T - 0.0018819 * T * T + 
            T * T * T / 545868 - T * T * T * T / 113065000;
  return ((D % 360) + 360) % 360; // Normalize to 0-360
}

/**
 * Calculate the lunar ecliptic longitude
 * Uses simplified calculation - for full accuracy, need more correction terms
 * @param jdn Julian Day Number
 * @returns Lunar ecliptic longitude in degrees (0-360)
 */
function lunarEclipticLongitude(jdn: number): number {
  const T = julianCenturiesSinceJ2000(jdn);
  const L = meanLunarLongitude(T);
  const M = meanLunarAnomaly(T);
  const M_rad = (M * Math.PI) / 180;
  
  // Simplified equation of center for Moon
  // Full implementation would include many more terms
  const C = 6.288774 * Math.sin(M_rad) +
            1.274027 * Math.sin(2 * M_rad) +
            0.658314 * Math.sin(3 * M_rad) +
            0.213618 * Math.sin(4 * M_rad);
  
  const longitude = L + C;
  return ((longitude % 360) + 360) % 360; // Normalize to 0-360
}

/**
 * Calculate the date of a new moon
 * A new moon occurs when the Moon and Sun have the same ecliptic longitude
 * 
 * Uses iterative refinement to find when lunar and solar longitudes are equal
 * 
 * @param jdn Reference Julian Day Number (approximate date)
 * @returns Julian Day Number of the new moon (refined)
 */
export function newMoonJDN(jdn: number): number {
  // Start with approximate date
  let currentJDN = jdn;
  
  // Refine using iterative method
  for (let i = 0; i < 10; i++) {
    const solarLong = trueSolarLongitude(currentJDN);
    const lunarLong = lunarEclipticLongitude(currentJDN);
    
    // Calculate difference in longitude
    let diff = lunarLong - solarLong;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    
    // If very close, we're done
    if (Math.abs(diff) < 0.01) {
      break;
    }
    
    // Estimate rate of change (degrees per day)
    const solarLong1 = trueSolarLongitude(currentJDN + 1);
    const lunarLong1 = lunarEclipticLongitude(currentJDN + 1);
    let rateOfChange = (lunarLong1 - lunarLong) - (solarLong1 - solarLong);
    if (rateOfChange > 180) rateOfChange -= 360;
    if (rateOfChange < -180) rateOfChange += 360;
    
    // Adjust date
    let adjustment = 0;
    if (Math.abs(rateOfChange) > 0.01) {
      adjustment = -diff / rateOfChange;
      currentJDN += adjustment;
    } else {
      // Fallback: use mean synodic month
      const SYNODIC_MONTH = 29.53058867;
      adjustment = diff > 0 ? -SYNODIC_MONTH / 2 : SYNODIC_MONTH / 2;
      currentJDN += adjustment;
    }
    
    // Prevent infinite loops
    if (Math.abs(adjustment) < 0.0001) {
      break;
    }
  }
  
  return Math.round(currentJDN);
}

/**
 * Find the next new moon after a given date
 * @param jdn Reference Julian Day Number
 * @returns Julian Day Number of the next new moon
 */
export function nextNewMoonJDN(jdn: number): number {
  // Approximate: new moons occur about every 29.5 days
  const SYNODIC_MONTH = 29.53058867;
  const approximateJDN = jdn + SYNODIC_MONTH;
  return newMoonJDN(approximateJDN);
}

/**
 * Find the previous new moon before a given date
 * @param jdn Reference Julian Day Number
 * @returns Julian Day Number of the previous new moon
 */
export function previousNewMoonJDN(jdn: number): number {
  // Approximate: new moons occur about every 29.5 days
  const SYNODIC_MONTH = 29.53058867;
  const approximateJDN = jdn - SYNODIC_MONTH;
  return newMoonJDN(approximateJDN);
}

/**
 * Calculate the solar term (jieqi) for a given date
 * Solar terms divide the year into 24 periods based on solar longitude
 * Each term is 15° of solar longitude (360° / 24 = 15°)
 * 
 * @param jdn Julian Day Number
 * @returns Solar term number (0-23), where 0 = 立春 (Start of Spring, ~315°)
 */
export function solarTerm(jdn: number): number {
  const longitude = trueSolarLongitude(jdn);
  
  // Solar terms start at 315° (立春, Start of Spring)
  // Each term is 15° apart
  // Term 0: 315°-330° (立春)
  // Term 1: 330°-345° (雨水)
  // ...
  // Term 23: 300°-315° (大寒)
  
  // Normalize: subtract 315° and divide by 15°
  let term = Math.floor((longitude - 315 + 360) % 360 / 15);
  
  return term;
}

/**
 * Find the date when a specific solar term occurs
 * Uses iterative refinement similar to vernal equinox calculation
 * @param year Gregorian year
 * @param term Solar term number (0-23)
 * @returns Julian Day Number when the solar term occurs
 */
export function solarTermJDN(year: number, term: number): number {
  // Each solar term is 15° apart, starting at 315°
  const targetLongitude = (315 + term * 15) % 360;
  
  // Approximate date: each term is about 15.2 days apart
  // Term 0 (立春) is around February 4-5
  const daysPerTerm = 365.25 / 24; // ~15.22 days
  const approximateDay = 4 + term * daysPerTerm; // Start from Feb 4
  const approximateMonth = 2; // February
  
  let jdn = gregorianToJDN(year, approximateMonth, Math.floor(approximateDay)) + 0.5;
  
  // Refine using iterative method (similar to vernal equinox)
  for (let i = 0; i < 10; i++) {
    const longitude = trueSolarLongitude(jdn);
    
    // Calculate difference from target
    let diff = longitude - targetLongitude;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    
    // If very close, we're done
    if (Math.abs(diff) < 0.01 || Math.abs(diff - 360) < 0.01) {
      break;
    }
    
    // Calculate rate of change (degrees per day)
    const longitude1 = trueSolarLongitude(jdn + 1);
    let rateOfChange = longitude1 - longitude;
    if (rateOfChange > 180) rateOfChange -= 360;
    if (rateOfChange < -180) rateOfChange += 360;
    
    // Adjust date
    let adjustment = 0;
    if (Math.abs(rateOfChange) > 0.01) {
      adjustment = -diff / rateOfChange;
      jdn += adjustment;
    } else {
      // Fallback: use average rate
      adjustment = -diff / 0.9856; // Average solar motion ~0.9856°/day
      jdn += adjustment;
    }
    
    // Prevent infinite loops
    if (Math.abs(adjustment) < 0.0001) {
      break;
    }
  }
  
  return Math.round(jdn);
}

/**
 * Calculate the winter solstice JDN for a given year
 * Winter solstice is solar term 21 (冬至, Dōngzhì) at 270°
 * @param year Gregorian year
 * @returns Julian Day Number of the winter solstice
 */
export function winterSolsticeJDN(year: number): number {
  // Winter solstice is solar term 21
  return solarTermJDN(year, 21);
}

