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
   const {  data, error}= await supabase.from("audit_logs").insert({
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
  

// make a util to return the children of a parent
export const getChildrenOfParent = async (parentId: number) : Promise<any[]> => {
  try {
 // Find all children (students) linked with this parent - only active students
 const { data: children, error: childrenError } = await supabase
 .from('parent_student_relationships')
 .select(`
   student:students (id, first_name, last_name, username, current_year_group_id, class_id, created_at, status)
 `)
 .eq('parent_id', parentId);

if (childrenError) throw childrenError;

// Extract just the student objects from the response
const studentObjects = children.map((item: any) => item.student).filter((student: any) => student != null);

console.log(studentObjects, 'all STUDENTS !')

  return studentObjects;
  } catch (error) {
    console.error('Error getting children of parent:', error);
    throw error;
  }
};

// Clean up student moderations and entities when student is deactivated
export const cleanupStudentOnDeactivation = async (studentId: number) => {
  try {
    // 1. Delete all moderations submitted by this student, 
    // Expect the moderations that are of personal_sections are pending whose action type is update
    
    const { error: deleteModerationsError } = await supabase
      .from('moderations')
      .delete()
      .eq('status','pending')
      .eq('student_id', studentId)
      .not('action_type', 'eq', 'update')
      .not('entity_type', 'eq', 'personal_sections'); // since, currently only personal_sections are coming with update action

      
      if (deleteModerationsError) {
        console.log('error deleting moderations !', deleteModerationsError)
        throw deleteModerationsError;
      };
      console.log('moderations deleted !')

    // 2. Handle student entities based on their status
    // Get all student entities (images, learnings, reflections, personal_sections, impacts, experiences)
    const entityTypes = ['student_images', 'student_learning_entities', 'reflections', 'personal_sections', 'student_impacts', 'student_experiences'];
    
    for (const entityType of entityTypes) {
      // only get those who's status are in : pending, pending_deletion, pending_updation
      const { data: entities, error: entitiesError } = await supabase
        .from(entityType)
        .select('*')
        .eq('student_id', studentId)
        .in('status', ['pending', 'pending_deletion', 'pending_updation']);

      if (entitiesError) throw entitiesError;

      for (const entity of entities) {
        if (entity.status === 'pending') {
          console.log('deleting :', entity)
          // Delete entities that were requested for creation
          const { error: deleteError } = await supabase
            .from(entityType)
            .delete()
            .eq('id', entity.id);
          
          if (deleteError) throw deleteError;
        } else if (entity.status === 'pending_deletion') {
          // Revert deletion requests - update status back to 'approved'
          const { error: revertError } = await supabase
            .from(entityType)
            .update({ 
              status: 'approved',
              
            })
            .eq('id', entity.id);
          
          if (revertError) throw revertError;
        } else if (entity.status === 'pending_updation') {
          console.log("WORKING ON PENDING UPDATION !", 'entity :-', entity)
          // find the respective moderation record
          const { data: moderation , error: moderationError } = await supabase
            .from('moderations')
            .select('*')
            .eq('id', entity.moderation_id)
            .single()
          console.log('ENTITY to test :-!! ', entity)
            const { error: revertUpdateError } = await supabase
            .from(entityType)
            .update({ 
              status: 'approved',
              content: moderation.old_content.content,
              moderation_id: null // De-link the moderation from the entity
            })
            .eq('id', entity.id);
            console.log('de-link and entity update done !')
          
          if (revertUpdateError) throw revertUpdateError;


            // Now delete the moderation
            const { error: deleteModerationError } = await supabase.from('moderations').delete().eq('id', entity.moderation_id);
            console.log('moderation deleted !')
            if (deleteModerationError) throw deleteModerationError;
           
          if (moderationError) throw moderationError;
            console.log(moderation.old_content, 'moderation old content !');
         
        }
      }
    }

    console.log(`Student ${studentId} deactivated - cleaned up moderations and entities`);
    return { success: true, message: 'Student cleanup completed successfully' };
  } catch (error) {
    console.error('Error cleaning up student on deactivation:', error);
    throw error;
  }
};

// Handle parent deactivation and child cascade logic
export const handleParentDeactivation = async (parentId: number) => {
  try {
    // Get all children of this parent through the relationship table
    const children = await getChildrenOfParent(parentId);

    if (!children || children.length === 0) {
      return { 
        success: true, 
        message: 'No children found for this parent.',
        affectedChildren: 0,
        childrenToUpdate: []
      };
    }

    let childrenToUpdate: any[] = [];
    let isLastActiveParent = false;

    // Check if this parent is the last active parent for any of their children
    for (const child of children) {
      // Get all parents of this child
      const { data: childParents, error: childParentsError } = await supabase
        .from('parent_student_relationship')
        .select(`
          parent:parents (
            id,
            status
          )
        `)
        .eq('student_id', child.id);

      if (childParentsError) throw childParentsError;

      // Count active parents for this child (including the current parent being deactivated)
      const activeParentsCount = childParents.filter((rel: any) => 
        rel.parent && rel.parent.status === 'active'
      ).length;

      console.log(activeParentsCount, 'activeParentsCount', childParents, 'parents !');

      // If there's no active parent left after de-activation, then this is the last active parent
      if (activeParentsCount === 0) {
        isLastActiveParent = true;
        break; // Found at least one child where this is the last active parent
      }
    }

    // If this parent is the last active parent for their children, deactivate all children
    if (isLastActiveParent) {
      childrenToUpdate = children;
    }

    return {
      success: true,
      message: isLastActiveParent 
        ? `Parent is the last active parent. ${children.length} child(ren) will be deactivated.`
        : `Parent is not the last active parent. No children will be affected.`,
      affectedChildren: childrenToUpdate.length,
      childrenToUpdate: childrenToUpdate,
      isLastActiveParent: isLastActiveParent
    };
  } catch (error) {
    console.error('Error handling parent deactivation:', error);
    throw error;
  }
};

// Handle parent activation and child cascade logic
export const handleParentActivation = async (parentId: number) => {
  try {
    // Get all children of this parent through the relationship table
    const children = await getChildrenOfParent(parentId);

    if (!children || children.length === 0) {
      return { 
        success: true, 
        message: 'No children found for this parent.',
        affectedChildren: 0,
        childrenToUpdate: []
      };
    }

    // When activating parent, no need to affect the children
    return {
      success: true,
      message: ``,
      affectedChildren: 0,
      childrenToUpdate: [],
      isLastActiveParent: false // Not applicable for activation
    };
  } catch (error) {
    console.error('Error handling parent activation:', error);
    throw error;
  }
};
