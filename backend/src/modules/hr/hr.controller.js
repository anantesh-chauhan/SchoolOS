import PDFDocument from 'pdfkit';
import prisma from '../../config/prisma.client.js';
import { employeeInput, salaryInput, attendanceInput, leaveInput } from './hr.validation.js';
import { audit, nextEmployeeId, monthRange, dateOnly, attendanceSummary, generatePayroll } from './hr.service.js';
import { statusWeight } from '../../services/attendance.service.js';
import { getTeacherForUser } from '../../utils/teacherAuthorization.util.js';

const manager = (u) => ['SCHOOL_OWNER','ADMIN','HR'].includes(u.role);
const selfEmployee = (user) => ({ schoolId: user.schoolId, deletedAt: null, OR: [{ userId: user.id }, ...(user.employeeId ? [{ employeeId: user.employeeId }] : []), ...(user.email ? [{ email: user.email }] : [])] });
const sendError = (res, error) => res.status(error.statusCode || (error.code === 'P2002' ? 409 : 500)).json({ success: false, message: error.code === 'P2002' ? 'A record with these details already exists' : error.message });
const serialize = (value) => JSON.parse(JSON.stringify(value, (_key, item) => typeof item === 'bigint' ? Number(item) : item));

// Teacher accounts and HR employee records are maintained by different modules.
// Link an existing record (or create the minimal teaching-staff record) on first
// self-service access, so a valid teacher account is never locked out of HR.
const resolveSelfEmployee = async (user) => {
  let employee = await prisma.employee.findFirst({ where: selfEmployee(user) });
  if (employee || user.role !== 'TEACHER') return employee;

  const teacher = await getTeacherForUser(user);
  if (!teacher) return null;

  employee = await prisma.employee.findFirst({
    where: {
      schoolId: user.schoolId,
      deletedAt: null,
      OR: [{ teacherId: teacher.id }, { employeeId: teacher.employeeId }],
    },
  });

  if (employee) {
    // Never attach this account to a record already owned by another teacher.
    if (employee.teacherId && employee.teacherId !== teacher.id) return null;
    const linked = await prisma.$transaction(async (tx) => {
      const updated = await tx.employee.update({
        where: { id: employee.id },
        data: { userId: user.id, teacherId: teacher.id },
      });
      await tx.employeeLeaveBalance.upsert({
        where: { employeeId_leaveYear: { employeeId: updated.id, leaveYear: new Date().getUTCFullYear() } },
        update: {},
        create: { employeeId: updated.id, leaveYear: new Date().getUTCFullYear() },
      });
      return updated;
    });
    return linked;
  }

  const name = teacher.teacherName.trim().split(/\s+/);
  const joiningDate = teacher.joiningYear
    ? new Date(Date.UTC(teacher.joiningYear, 0, 1))
    : new Date();
  try {
    return await prisma.$transaction(async (tx) => {
      const created = await tx.employee.create({
        data: {
          schoolId: user.schoolId,
          userId: user.id,
          teacherId: teacher.id,
          employeeId: teacher.employeeId,
          firstName: name[0] || user.name || 'Teacher',
          lastName: name.slice(1).join(' ') || null,
          mobile: teacher.phone || 'Not provided',
          email: teacher.email || user.email,
          department: 'Academics',
          designation: teacher.designation || 'Teacher',
          category: 'TEACHING',
          employmentType: teacher.employmentType,
          joiningDate,
        },
      });
      await tx.employeeLeaveBalance.create({ data: { employeeId: created.id, leaveYear: new Date().getUTCFullYear() } });
      return created;
    });
  } catch (error) {
    // A concurrent first visit may have created the record; use that safely.
    if (error.code !== 'P2002') throw error;
    return prisma.employee.findFirst({ where: selfEmployee(user) });
  }
};

const selfEmployeeId = async (user) => (await resolveSelfEmployee(user))?.id || null;

export const dashboard = async (req,res) => { try { const schoolId=req.user.schoolId; const today=dateOnly(new Date()); const monthStart=new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth(),1)); const [total,teaching,present,absent,leaves,pendingLeaves,payroll,newJoinings,birthdays,distribution]=await Promise.all([prisma.employee.count({where:{schoolId,deletedAt:null,status:{in:['ACTIVE','ON_LEAVE']}}}),prisma.employee.count({where:{schoolId,deletedAt:null,category:'TEACHING',status:{in:['ACTIVE','ON_LEAVE']}}}),prisma.employeeAttendance.count({where:{schoolId,attendanceDate:today,status:{in:['PRESENT','LATE','EARLY_EXIT','WORK_FROM_HOME','OFFICIAL_DUTY']}}}),prisma.employeeAttendance.count({where:{schoolId,attendanceDate:today,status:'ABSENT'}}),prisma.employeeAttendance.count({where:{schoolId,attendanceDate:today,status:{in:['PAID_LEAVE','CASUAL_LEAVE','MEDICAL_LEAVE','EARNED_LEAVE','MATERNITY_LEAVE','PATERNITY_LEAVE']}}}),prisma.employeeLeaveApplication.count({where:{schoolId,status:'PENDING'}}),prisma.employeePayroll.aggregate({where:{schoolId,payrollMonth:monthStart},_count:true,_sum:{netSalary:true}}),prisma.employee.count({where:{schoolId,deletedAt:null,joiningDate:{gte:new Date(Date.now()-30*86400000)}}}),prisma.employee.findMany({where:{schoolId,deletedAt:null,dateOfBirth:{not:null}},select:{id:true,firstName:true,lastName:true,dateOfBirth:true},take:50}),prisma.employee.groupBy({by:['category'],where:{schoolId,deletedAt:null,status:{in:['ACTIVE','ON_LEAVE']}},_count:true})]); const thisMonthBirthdays=birthdays.filter(x=>x.dateOfBirth.getUTCMonth()===today.getUTCMonth()).slice(0,8); return res.json({success:true,data:{cards:{totalEmployees:total,teachingStaff:teaching,nonTeachingStaff:total-teaching,presentToday:present,absentToday:absent,leavesToday:leaves,pendingLeaveRequests:pendingLeaves,payrollGenerated:payroll._count,salaryPending:Number(payroll._sum.netSalary||0),newJoinings},distribution:distribution.map(x=>({name:x.category,value:x._count})),birthdays:thisMonthBirthdays}}); } catch(e){return sendError(res,e);} };

export const employees = async (req,res) => { try { const page=Math.max(1,Number(req.query.page)||1),take=Math.min(100,Math.max(1,Number(req.query.limit)||24)); const search=String(req.query.search||'').trim(); const where={schoolId:req.user.schoolId,deletedAt:null,...(req.query.category?{category:req.query.category}:{}),...(req.query.status?{status:req.query.status}:{}),...(req.query.department?{department:req.query.department}:{}),...(search?{OR:[{employeeId:{contains:search,mode:'insensitive'}},{firstName:{contains:search,mode:'insensitive'}},{lastName:{contains:search,mode:'insensitive'}},{mobile:{contains:search}},{email:{contains:search,mode:'insensitive'}},{designation:{contains:search,mode:'insensitive'}}]}:{})}; const [rows,total]=await Promise.all([prisma.employee.findMany({where,include:{salaryRevisions:{orderBy:{effectiveFrom:'desc'},take:1},attendances:{where:{attendanceDate:dateOnly(new Date())},take:1}},orderBy:{firstName:'asc'},skip:(page-1)*take,take}),prisma.employee.count({where})]); return res.json({success:true,data:{employees:serialize(rows),pagination:{page,limit:take,total,pages:Math.ceil(total/take)}}}); }catch(e){return sendError(res,e);} };
export const employee = async (req,res) => { try { const id=manager(req.user)?req.params.id:await selfEmployeeId(req.user); if(!id||(!manager(req.user)&&id!==req.params.id))return res.status(404).json({success:false,message:'Employee not found'}); const row=await prisma.employee.findFirst({where:{id,schoolId:req.user.schoolId,deletedAt:null},include:{documents:true,salaryRevisions:{orderBy:{effectiveFrom:'desc'}},leaveBalances:true,leaveApplications:{orderBy:{createdAt:'desc'},take:20},payrolls:{orderBy:{payrollMonth:'desc'},take:24},attendances:{orderBy:{attendanceDate:'desc'},take:62}}}); if(!row)return res.status(404).json({success:false,message:'Employee not found'}); return res.json({success:true,data:serialize(row)});}catch(e){return sendError(res,e);} };
export const me = async (req,res) => { try { const id=await selfEmployeeId(req.user); const row=id&&await prisma.employee.findFirst({where:{id,schoolId:req.user.schoolId,deletedAt:null},include:{documents:true,salaryRevisions:{orderBy:{effectiveFrom:'desc'},take:1},leaveBalances:{orderBy:{leaveYear:'desc'},take:1},leaveApplications:{orderBy:{createdAt:'desc'},take:20},payrolls:{orderBy:{payrollMonth:'desc'},take:24},attendances:{orderBy:{attendanceDate:'desc'},take:180}}});if(!row)return res.status(404).json({success:false,message:'Employee profile is not linked to this account'});return res.json({success:true,data:serialize(row)});}catch(e){return sendError(res,e);} };

export const platformAnalytics = async (req,res) => { try { const [schools,totals,monthly]=await Promise.all([prisma.school.findMany({where:{status:'ACTIVE'},select:{id:true,schoolName:true,schoolCode:true,_count:{select:{employees:true}}},orderBy:{schoolName:'asc'}}),prisma.employee.aggregate({where:{deletedAt:null},_count:true}),prisma.employeePayroll.groupBy({by:['payrollMonth'],_sum:{netSalary:true},_count:true,orderBy:{payrollMonth:'desc'},take:12})]);return res.json({success:true,data:{totalEmployees:totals._count,schools:schools.map(x=>({id:x.id,name:x.schoolName,code:x.schoolCode,employees:x._count.employees})),monthlyPayroll:monthly.map(x=>({month:x.payrollMonth,total:Number(x._sum.netSalary||0),records:x._count}))}});}catch(e){return sendError(res,e);} };
export const createEmployee = async (req,res) => { try { const input=employeeInput(req.body); const salary=req.body.salary?salaryInput(req.body.salary):null; const row=await prisma.$transaction(async tx=>{const employeeId=await nextEmployeeId(tx,req.user.schoolId);const created=await tx.employee.create({data:{...input,schoolId:req.user.schoolId,employeeId}});if(salary)await tx.employeeSalaryRevision.create({data:{...salary,employeeId:created.id,approvedById:req.user.id}});await tx.employeeLeaveBalance.create({data:{employeeId:created.id,leaveYear:new Date().getUTCFullYear()}});await audit(tx,req.user,req,'EMPLOYEE_CREATED','EMPLOYEE',created.id,null,{employeeId,designation:created.designation});return created;});return res.status(201).json({success:true,data:serialize(row),message:'Employee created'});}catch(e){return sendError(res,e);} };
export const updateEmployee = async(req,res)=>{try{const old=await prisma.employee.findFirst({where:{id:req.params.id,schoolId:req.user.schoolId,deletedAt:null}});if(!old)return res.status(404).json({success:false,message:'Employee not found'});const input=employeeInput(req.body,true);const row=await prisma.$transaction(async tx=>{const updated=await tx.employee.update({where:{id:old.id},data:input});if(req.body.salary)await tx.employeeSalaryRevision.create({data:{...salaryInput(req.body.salary),employeeId:old.id,approvedById:req.user.id}});await audit(tx,req.user,req,'EMPLOYEE_UPDATED','EMPLOYEE',old.id,{status:old.status,designation:old.designation},{status:updated.status,designation:updated.designation},req.body.changeReason);return updated;});return res.json({success:true,data:serialize(row),message:'Employee updated'});}catch(e){return sendError(res,e);}};

export const policy = async(req,res)=>{try{const row=await prisma.hrLeavePolicy.upsert({where:{schoolId:req.user.schoolId},update:{},create:{schoolId:req.user.schoolId}});return res.json({success:true,data:serialize(row)});}catch(e){return sendError(res,e);}};
export const savePolicy = async(req,res)=>{try{const data={annualLeaveCount:Number(req.body.annualLeaveCount??15),monthlyPaidLimit:Number(req.body.monthlyPaidLimit??2),carryForward:req.body.carryForward!==false,maxCarryForward:req.body.maxCarryForward==null?null:Number(req.body.maxCarryForward),leaveExpiryMonth:req.body.leaveExpiryMonth?Number(req.body.leaveExpiryMonth):null,lateEntriesPerDay:req.body.lateEntriesPerDay?Number(req.body.lateEntriesPerDay):null,includeWeeklyOff:Boolean(req.body.includeWeeklyOff),rules:req.body.rules||undefined,updatedById:req.user.id};const old=await prisma.hrLeavePolicy.findUnique({where:{schoolId:req.user.schoolId}});const row=await prisma.$transaction(async tx=>{const saved=await tx.hrLeavePolicy.upsert({where:{schoolId:req.user.schoolId},update:data,create:{schoolId:req.user.schoolId,...data}});await audit(tx,req.user,req,'LEAVE_POLICY_UPDATED','HR_LEAVE_POLICY',saved.id,old,data);return saved;});return res.json({success:true,data:serialize(row),message:'Leave policy saved'});}catch(e){return sendError(res,e);}};

export const attendance = async(req,res)=>{try{const range=monthRange(req.query.month);const employeeId=req.query.employeeId;const where={schoolId:req.user.schoolId,attendanceDate:{gte:range.start,lt:range.end},...(employeeId?{employeeId}:{})};if(!manager(req.user)){const id=await selfEmployeeId(req.user);if(!id)return res.status(404).json({success:false,message:'Employee profile not found'});where.employeeId=id;}const rows=await prisma.employeeAttendance.findMany({where,include:{employee:{select:{employeeId:true,firstName:true,lastName:true,department:true,designation:true}}},orderBy:{attendanceDate:'desc'}});return res.json({success:true,data:serialize(rows)});}catch(e){return sendError(res,e);}};
export const saveAttendance = async(req,res)=>{try{const records=Array.isArray(req.body.records)?req.body.records:[req.body];if(records.length>500)return res.status(400).json({success:false,message:'Maximum 500 attendance records per request'});const inputs=records.map(attendanceInput);const ids=[...new Set(inputs.map(x=>x.employeeId))];if(ids.length!==inputs.length)return res.status(409).json({success:false,message:'Duplicate employee attendance records are not allowed'});const count=await prisma.employee.count({where:{schoolId:req.user.schoolId,id:{in:ids},deletedAt:null}});if(count!==ids.length)return res.status(400).json({success:false,message:'One or more employees do not belong to this school'});const result=await prisma.$transaction(async tx=>{const saved=[];for(const input of inputs){const attendanceDate=dateOnly(input.attendanceDate);const calculated={attendanceUnits:statusWeight(input.status),salaryImpactDays:['ABSENT','UNPAID_LEAVE'].includes(input.status)?1:0};const row=await tx.employeeAttendance.upsert({where:{schoolId_employeeId_attendanceDate:{schoolId:req.user.schoolId,employeeId:input.employeeId,attendanceDate}},update:{...input,...calculated,attendanceDate,markedById:req.user.id},create:{...input,...calculated,schoolId:req.user.schoolId,attendanceDate,markedById:req.user.id}});saved.push(row);}await audit(tx,req.user,req,'ATTENDANCE_BULK_SAVED','EMPLOYEE_ATTENDANCE',null,null,{count:saved.length,dates:[...new Set(saved.map(x=>x.attendanceDate.toISOString().slice(0,10)))]});return saved;});return res.json({success:true,data:serialize(result),message:`Saved ${result.length} attendance records`});}catch(e){return sendError(res,e);}};

export const leaves = async(req,res)=>{try{const where={schoolId:req.user.schoolId,...(req.query.status?{status:req.query.status}:{})};if(!manager(req.user)){const id=await selfEmployeeId(req.user);if(!id)return res.status(404).json({success:false,message:'Employee profile not found'});where.employeeId=id;}const rows=await prisma.employeeLeaveApplication.findMany({where,include:{employee:{select:{employeeId:true,firstName:true,lastName:true,department:true}}},orderBy:{createdAt:'desc'},take:200});return res.json({success:true,data:serialize(rows)});}catch(e){return sendError(res,e);}};
export const applyLeave=async(req,res)=>{try{const input=leaveInput(req.body);if(!manager(req.user)){const id=await selfEmployeeId(req.user);if(!id||id!==input.employeeId)return res.status(403).json({success:false,message:'You can only apply for your own leave'});}const employee=await prisma.employee.findFirst({where:{id:input.employeeId,schoolId:req.user.schoolId,deletedAt:null}});if(!employee)return res.status(404).json({success:false,message:'Employee not found'});const overlap=await prisma.employeeLeaveApplication.findFirst({where:{schoolId:req.user.schoolId,employeeId:input.employeeId,status:{in:['PENDING','APPROVED']},startDate:{lte:input.endDate},endDate:{gte:input.startDate}}});if(overlap)return res.status(409).json({success:false,message:'Leave dates overlap an existing request'});const row=await prisma.employeeLeaveApplication.create({data:{...input,schoolId:req.user.schoolId}});return res.status(201).json({success:true,data:serialize(row),message:'Leave application submitted'});}catch(e){return sendError(res,e);}};
export const reviewLeave=async(req,res)=>{try{const status=String(req.body.status||'').toUpperCase();if(!['APPROVED','REJECTED'].includes(status))return res.status(400).json({success:false,message:'status must be APPROVED or REJECTED'});const old=await prisma.employeeLeaveApplication.findFirst({where:{id:req.params.id,schoolId:req.user.schoolId,status:'PENDING'}});if(!old)return res.status(404).json({success:false,message:'Pending leave request not found'});const row=await prisma.$transaction(async tx=>{const updated=await tx.employeeLeaveApplication.update({where:{id:old.id},data:{status,reviewedById:req.user.id,reviewedAt:new Date(),reviewComment:req.body.reviewComment||null}});if(status==='APPROVED'&&old.leaveType!=='UNPAID')await tx.employeeLeaveBalance.upsert({where:{employeeId_leaveYear:{employeeId:old.employeeId,leaveYear:old.startDate.getUTCFullYear()}},update:{used:{increment:old.days}},create:{employeeId:old.employeeId,leaveYear:old.startDate.getUTCFullYear(),used:old.days}});await audit(tx,req.user,req,`LEAVE_${status}`,'EMPLOYEE_LEAVE',old.id,{status:old.status},{status},req.body.reviewComment);return updated;});return res.json({success:true,data:serialize(row),message:`Leave ${status.toLowerCase()}`});}catch(e){return sendError(res,e);}};

const leaveAttendanceStatus = { PAID:'PAID_LEAVE', CASUAL:'CASUAL_LEAVE', MEDICAL:'MEDICAL_LEAVE', EARNED:'EARNED_LEAVE', MATERNITY:'MATERNITY_LEAVE', PATERNITY:'PATERNITY_LEAVE' };
export const reviewLeavePolicyAware = async (req, res) => {
  try {
    const status = String(req.body.status || '').toUpperCase();
    if (!['APPROVED','REJECTED'].includes(status)) return res.status(400).json({ success:false, message:'status must be APPROVED or REJECTED' });
    const request = await prisma.employeeLeaveApplication.findFirst({ where:{ id:req.params.id, schoolId:req.user.schoolId, status:'PENDING' } });
    if (!request) return res.status(404).json({ success:false, message:'Pending leave request not found' });
    const result = await prisma.$transaction(async (tx) => {
      let effectiveType = request.leaveType;
      if (status === 'APPROVED' && request.leaveType !== 'UNPAID') {
        const year = request.startDate.getUTCFullYear();
        const [policy, balance, priorApproved] = await Promise.all([
          tx.hrLeavePolicy.upsert({ where:{ schoolId:req.user.schoolId }, update:{}, create:{ schoolId:req.user.schoolId } }),
          tx.employeeLeaveBalance.upsert({ where:{ employeeId_leaveYear:{ employeeId:request.employeeId, leaveYear:year } }, update:{}, create:{ employeeId:request.employeeId, leaveYear:year } }),
          tx.employeeLeaveApplication.findMany({ where:{ schoolId:req.user.schoolId, employeeId:request.employeeId, status:'APPROVED', leaveType:{ not:'UNPAID' }, startDate:{ gte:new Date(Date.UTC(year,0,1)), lt:new Date(Date.UTC(year+1,0,1)) } }, select:{ days:true, startDate:true } }),
        ]);
        const annualAvailable = Math.max(0, Number(policy.annualLeaveCount) + Number(balance.opening) + Number(balance.adjusted) - Number(balance.used));
        const monthIndex = request.startDate.getUTCMonth();
        const usedThroughMonth = priorApproved.filter(x => x.startDate.getUTCMonth() <= monthIndex).reduce((sum,x)=>sum+Number(x.days),0);
        const monthlyAvailable = policy.carryForward ? Math.max(0, Number(policy.monthlyPaidLimit) * (monthIndex + 1) - usedThroughMonth) : Math.max(0, Number(policy.monthlyPaidLimit) - priorApproved.filter(x=>x.startDate.getUTCMonth()===monthIndex).reduce((sum,x)=>sum+Number(x.days),0));
        if (Number(request.days) > Math.min(annualAvailable, monthlyAvailable)) effectiveType = 'UNPAID';
        else await tx.employeeLeaveBalance.update({ where:{ id:balance.id }, data:{ used:{ increment:request.days } } });
      }
      const updated = await tx.employeeLeaveApplication.update({ where:{ id:request.id }, data:{ status, leaveType:effectiveType, reviewedById:req.user.id, reviewedAt:new Date(), reviewComment:req.body.reviewComment || (effectiveType==='UNPAID' && request.leaveType!=='UNPAID' ? 'Approved as unpaid leave because the configured paid quota was exhausted.' : null) } });
      if (status === 'APPROVED') {
        const attendanceStatus = effectiveType === 'UNPAID' ? 'ABSENT' : leaveAttendanceStatus[effectiveType] || 'PAID_LEAVE';
        for (let day=dateOnly(request.startDate); day<=dateOnly(request.endDate); day=new Date(day.getTime()+86400000)) {
          if ([0,6].includes(day.getUTCDay())) continue;
          await tx.employeeAttendance.upsert({ where:{ schoolId_employeeId_attendanceDate:{ schoolId:req.user.schoolId, employeeId:request.employeeId, attendanceDate:day } }, update:{ status:attendanceStatus, attendanceUnits:0, salaryImpactDays:effectiveType==='UNPAID'?1:0, leaveReference:request.id, approvalStatus:'APPROVED', remarks:`Approved leave ${request.id}`, markedById:req.user.id }, create:{ schoolId:req.user.schoolId, employeeId:request.employeeId, attendanceDate:day, status:attendanceStatus, attendanceUnits:0, salaryImpactDays:effectiveType==='UNPAID'?1:0, leaveReference:request.id, approvalStatus:'APPROVED', source:'MANUAL', remarks:`Approved leave ${request.id}`, markedById:req.user.id } });
        }
      }
      await audit(tx,req.user,req,`LEAVE_${status}`,'EMPLOYEE_LEAVE',request.id,{status:request.status,leaveType:request.leaveType},{status,leaveType:effectiveType},req.body.reviewComment);
      return updated;
    });
    return res.json({ success:true, data:serialize(result), message:`Leave ${status.toLowerCase()}${result.leaveType==='UNPAID'?' as unpaid':''}` });
  } catch (error) { return sendError(res,error); }
};

export const payrolls=async(req,res)=>{try{const range=monthRange(req.query.month);const where={schoolId:req.user.schoolId,payrollMonth:range.start};if(!manager(req.user)){const id=await selfEmployeeId(req.user);if(!id)return res.status(404).json({success:false,message:'Employee profile not found'});where.employeeId=id;}const rows=await prisma.employeePayroll.findMany({where,include:{employee:{select:{employeeId:true,firstName:true,lastName:true,department:true,designation:true}}},orderBy:{employee:{firstName:'asc'}}});return res.json({success:true,data:serialize(rows)});}catch(e){return sendError(res,e);}};
export const runPayroll=async(req,res)=>{try{const rows=await generatePayroll({schoolId:req.user.schoolId,month:req.body.month,employeeIds:req.body.employeeIds,user:req.user,req});return res.status(201).json({success:true,data:serialize(rows),message:`Payroll ready for ${rows.length} employees`});}catch(e){return sendError(res,e);}};
export const updatePayroll=async(req,res)=>{try{const old=await prisma.employeePayroll.findFirst({where:{id:req.params.id,schoolId:req.user.schoolId}});if(!old)return res.status(404).json({success:false,message:'Payroll not found'});const status=String(req.body.status||'').toUpperCase();if(!['PENDING','PROCESSED','PAID','CANCELLED','HOLD'].includes(status))return res.status(400).json({success:false,message:'Invalid payroll status'});const row=await prisma.$transaction(async tx=>{const updated=await tx.employeePayroll.update({where:{id:old.id},data:{status,paidAt:status==='PAID'?new Date():old.paidAt,transactionReference:req.body.transactionReference??old.transactionReference,remarks:req.body.remarks??old.remarks}});await audit(tx,req.user,req,'PAYROLL_STATUS_UPDATED','EMPLOYEE_PAYROLL',old.id,{status:old.status},{status,transactionReference:updated.transactionReference},req.body.remarks);return updated;});return res.json({success:true,data:serialize(row),message:'Payroll status updated'});}catch(e){return sendError(res,e);}};
export const payslip=async(req,res)=>{try{const payroll=await prisma.employeePayroll.findFirst({where:{id:req.params.id,schoolId:req.user.schoolId},include:{employee:true,school:true}});if(!payroll)return res.status(404).json({success:false,message:'Payslip not found'});if(!manager(req.user)){const id=await selfEmployeeId(req.user);if(id!==payroll.employeeId)return res.status(403).json({success:false,message:'You can only download your own payslip'});}const doc=new PDFDocument({margin:48,size:'A4'});res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition',`attachment; filename="${payroll.payslipNumber}.pdf"`);doc.pipe(res);doc.fontSize(20).text(payroll.school.schoolName,{align:'center'}).fontSize(11).text('SALARY PAYSLIP',{align:'center'}).moveDown();doc.fontSize(10).text(`Payslip: ${payroll.payslipNumber}`).text(`Employee: ${payroll.employee.firstName} ${payroll.employee.lastName||''}`).text(`Employee ID: ${payroll.employee.employeeId}`).text(`Department: ${payroll.employee.department}`).text(`Designation: ${payroll.employee.designation}`).text(`Month: ${payroll.payrollMonth.toLocaleDateString('en-IN',{month:'long',year:'numeric',timeZone:'UTC'})}`).moveDown();doc.fontSize(12).text('Attendance & earnings').moveDown(.5);[['Working days',payroll.workingDays],['Payable days',payroll.payableDays],['Monthly gross',payroll.monthlyGross],['Attendance-adjusted pay',payroll.basePay],['Allowances',payroll.allowanceTotal],['Deductions',payroll.deductionTotal]].forEach(([label,value])=>doc.fontSize(10).text(`${label}: ${Number(value).toLocaleString('en-IN',{style:label.includes('days')?'decimal':'currency',currency:'INR'})}`));doc.moveDown().fontSize(15).text(`Net salary: ${Number(payroll.netSalary).toLocaleString('en-IN',{style:'currency',currency:'INR'})}`).moveDown().fontSize(9).fillColor('#666').text('This is a system-generated payslip.',{align:'center'});doc.end();}catch(e){if(!res.headersSent)return sendError(res,e);}};
export const report=async(req,res)=>{try{const range=monthRange(req.query.month);const rows=await prisma.employeePayroll.findMany({where:{schoolId:req.user.schoolId,payrollMonth:range.start},include:{employee:true},orderBy:{employee:{employeeId:'asc'}}});const format=String(req.query.format||'json').toLowerCase();const data=rows.map(r=>({employeeId:r.employee.employeeId,name:`${r.employee.firstName} ${r.employee.lastName||''}`.trim(),department:r.employee.department,workingDays:Number(r.workingDays),payableDays:Number(r.payableDays),gross:Number(r.monthlyGross),deductions:Number(r.deductionTotal),netSalary:Number(r.netSalary),status:r.status}));if(format==='csv'){const fields=Object.keys(data[0]||{employeeId:'',name:'',department:'',workingDays:'',payableDays:'',gross:'',deductions:'',netSalary:'',status:''});res.type('text/csv').set('Content-Disposition',`attachment; filename="salary-register-${req.query.month}.csv"`);return res.send([fields.join(','),...data.map(row=>fields.map(f=>`"${String(row[f]??'').replaceAll('"','""')}"`).join(','))].join('\n'));}return res.json({success:true,data});}catch(e){return sendError(res,e);}};
