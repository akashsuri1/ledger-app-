import assert from "node:assert/strict";
import { companyDestination, initialCompanyId } from "../src/utils/companyRouting";
import type { CompanyDto, PreferencesDto } from "../src/api/types";
import { apiRequest, ApiClientError } from "../src/api/apiClient";

const company=(id:number):CompanyDto=>({id,name:`Company ${id}`,address:"",phone:"",gstin:"",email:"",role:"OWNER",createdAt:"2026-01-01T00:00:00Z"});
const preferences:PreferencesDto={rememberLastCompany:false,lastActiveCompanyId:null,appearance:{fontFamily:"inter",baseFontSize:16,uiScale:100,density:"comfortable",tableDensity:"normal",accentColor:"blue",theme:"light"}};
assert.equal(companyDestination([],preferences),"setup");
assert.equal(companyDestination([company(1)],preferences),"dashboard");
assert.equal(companyDestination([company(1),company(2)],preferences),"select");
assert.equal(companyDestination([company(1),company(2)],{...preferences,rememberLastCompany:true,lastActiveCompanyId:2}),"dashboard");
assert.equal(initialCompanyId([company(1),company(2)],{...preferences,lastActiveCompanyId:2}),2);

let cookie="";Object.defineProperty(globalThis,"document",{configurable:true,value:{get cookie(){return cookie},set cookie(value:string){cookie=value}}});
const calls: Array<{url:string;init:RequestInit}> = [];
Object.defineProperty(globalThis,"fetch",{configurable:true,value:async(url:string,init:RequestInit={})=>{calls.push({url,init});if(url.endsWith("/api/auth/csrf")){cookie="XSRF-TOKEN=test-token";return new Response(JSON.stringify({data:{cookieName:"XSRF-TOKEN",headerName:"X-XSRF-TOKEN"}}),{status:200,headers:{"Content-Type":"application/json"}})}return new Response(JSON.stringify({data:{id:1}}),{status:200,headers:{"Content-Type":"application/json"}})}});
await apiRequest<{id:number}>("/api/test",{method:"POST",body:{name:"test"}});
assert.equal(calls.length,2);assert.equal(calls[1].init.credentials,"include");assert.equal(new Headers(calls[1].init.headers).get("X-XSRF-TOKEN"),"test-token");assert.equal(new Headers(calls[1].init.headers).get("Content-Type"),"application/json");

Object.defineProperty(globalThis,"fetch",{configurable:true,value:async()=>new Response(JSON.stringify({error:{code:"VALIDATION_ERROR",message:"Invalid amount",fields:{amount:"Whole rupees required"}}}),{status:422,headers:{"Content-Type":"application/json"}})});
await assert.rejects(()=>apiRequest("/api/test"),error=>error instanceof ApiClientError&&error.code==="VALIDATION_ERROR"&&error.fields?.amount==="Whole rupees required"&&error.status===422);
console.log("Authentication routing, credentials, CSRF, and API error checks passed.");
