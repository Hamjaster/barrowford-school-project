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
  