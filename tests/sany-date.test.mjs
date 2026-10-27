import test from 'node:test';
import assert from 'node:assert/strict';
import '../src/shared/matcher-core.js';

test('Sany date capability identifies only the exact observed tenant',()=>{
 const core=globalThis.ResumeHelperCore;
 assert.equal(core.detectZhiyeTemplate('SANYCAMPUS.ZHIYE.COM'),'sany');
 for(const host of ['sany.zhiye.com','other.zhiye.com','www.sanycampus.zhiye.com','sanycampus.zhiye.com.attacker.invalid'])assert.equal(core.detectZhiyeTemplate(host),'legacy');
});
