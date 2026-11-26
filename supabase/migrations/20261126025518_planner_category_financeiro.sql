-- Troca a área "ingles" por "financeiro" (aulas de inglês passam a ser "estudos")
update planner.tasks  set category = 'estudos' where category = 'ingles';
update planner.habits set category = 'estudos' where category = 'ingles';
update planner.goals  set category = 'estudos' where category = 'ingles';

alter table planner.tasks  drop constraint tasks_category_check;
alter table planner.habits drop constraint habits_category_check;
alter table planner.goals  drop constraint goals_category_check;

alter table planner.tasks  add constraint tasks_category_check  check (category in ('estudos','trabalho','financeiro','pessoal','saude'));
alter table planner.habits add constraint habits_category_check check (category in ('estudos','trabalho','financeiro','pessoal','saude'));
alter table planner.goals  add constraint goals_category_check  check (category in ('estudos','trabalho','financeiro','pessoal','saude'));
