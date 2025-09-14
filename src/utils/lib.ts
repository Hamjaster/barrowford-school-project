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