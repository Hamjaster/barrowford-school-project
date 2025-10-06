import { supabase } from "../db/supabase.js";

// helper function to get a teacher record which teaches student_id based on same class_id and year_group_id
export const getTeacherRecordFromClass = async ({class_id, year_group_id}: {class_id: string, year_group_id: string}) => {
    console.log('class_id', class_id, 'year_group_id', year_group_id);
    const { data: teacher, error: teacherErr } =  await supabase
      .from('staffs')
      .select('*')
      .eq('class_id', class_id)
      .eq('year_group_id', year_group_id)
      .single();
    console.log('teacher', teacher, teacherErr);

    if (teacherErr || !teacher) {
      return null;
    }
    console.log('teacher', teacher);
    return teacher;
  };

// helper function to find user by auth_user_id and return the actual database ID
export const findUserByAuthUserId = async (authUserId: string) => {
  // Check all role tables to find the user
  const roleTables = ['admins', 'staff_admins', 'staffs', 'parents', 'students'];
  
  for (const table of roleTables) {
    const { data: user, error } = await supabase
      .from(table)
      .select('id, auth_user_id')
      .eq('auth_user_id', authUserId)
      .single();
    
    if (!error && user) {
      return user;
    }
  }
  
  return null;
};
export const formatRole = (role: string) => {
  return role
    .split('_') // Split by underscore
    .map(word => word.charAt(0).toUpperCase() + word.slice(1)) // Capitalize each word
    .join(' '); // Join with space
};
 export const logAudit = async ({
    action,
    entityType,
    entityId,
    oldValue,
    newValue,
    actorId,
    actorRole
  }: {
    action: string;
    entityType: string;
    entityId: string;
    oldValue: any;
    newValue: any;
    actorId: string;
    actorRole: string;
  }) => {
   const {  data, error}= await supabase.from("auditlogs").insert({
      action,
      entity_type: entityType,
      entity_id: entityId,
      old_value: oldValue ? JSON.stringify(oldValue) : null,
      new_value: newValue ? JSON.stringify(newValue) : null,
      actor_id: actorId,
      actor_role: actorRole,
    });

    console.log('auditlog created', data, error);
  };

/**
 * Calculate the academic week number based on the current date
 * Academic year starts from the first full week of September
 * A full week starts on Monday and the first full week is the first Monday-Sunday period in September
 * @param date - Optional date to calculate from, defaults to current date
 * @returns String in format "Week X" where X is the week number
 */
export const calculateAcademicWeek = (date?: Date): string => {
  const currentDate = date || new Date();
  const currentYear = currentDate.getFullYear();
  
  // Determine which academic year we're in
  let academicYear = currentYear;
  if (currentDate.getMonth() < 8) { // Before September
    academicYear = currentYear - 1;
  }
  
  // Find the first Monday of September for the academic year
  const septemberFirst = new Date(academicYear, 8, 1); // September 1st
  const dayOfWeek = septemberFirst.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  // Calculate days to add to get to the first Monday
  // If September 1st is Monday (1), add 0 days
  // If September 1st is Tuesday (2), add 6 days (to next Monday)
  // If September 1st is Sunday (0), add 1 day
  const daysToFirstMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 0 : (8 - dayOfWeek);
  
  const firstMondayOfSeptember = new Date(septemberFirst);
  firstMondayOfSeptember.setDate(septemberFirst.getDate() + daysToFirstMonday);
  
  // Calculate the difference in milliseconds
  const timeDifference = currentDate.getTime() - firstMondayOfSeptember.getTime();
  
  // Convert to days and then to weeks
  const daysDifference = Math.floor(timeDifference / (1000 * 60 * 60 * 24));
  const weekNumber = Math.floor(daysDifference / 7) + 1;
  
  // Ensure we don't return negative week numbers or zero
  if (weekNumber < 1) {
    return "Week 1";
  }
  
  return `Week ${weekNumber}`;
};

/**
 * Get previous weeks for a user based on the current academic week (including current week)
 * @param currentWeek - Optional current week string (e.g., "Week 4"), defaults to current academic week
 * @returns Array of week strings including current week (e.g., ["Week 1", "Week 2", "Week 3", "Week 4"])
 */
export const getPreviousWeeks = (currentWeek?: string): string[] => {
  const week = currentWeek || calculateAcademicWeek();
  
  // Extract week number from string like "Week 4"
  const weekNumberMatch = week.match(/Week (\d+)/);
  if (!weekNumberMatch) {
    return [];
  }
  
  const currentWeekNumber = parseInt(weekNumberMatch[1], 10);
  
  // If current week is 1 or less, return just Week 1
  if (currentWeekNumber <= 1) {
    return ["Week 1"];
  }
  
  // Generate array of weeks including current week
  const previousWeeks: string[] = [];
  for (let i = 1; i <= currentWeekNumber; i++) {
    previousWeeks.push(`Week ${i}`);
  }
  
  return previousWeeks;
};
  