import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mailSenderImage} from '../apps/app/src/runtime/mail-sender-image.ts';
test('website icons use exact sender domains without sending the address',()=>{
 assert.equal(mailSenderImage('notice@LinkedIn.com',true),'/icons/senders/linkedin.com.png');
 assert.equal(mailSenderImage('a@service.paypal.com',true),'/icons/senders/paypal.com.png');
 assert.equal(mailSenderImage('a@paypal.com.attacker.org',true),null);
 assert.equal(mailSenderImage('a@news.example.org',true),null);
});
test('disabled remote images and personal senders keep initials',()=>{
 for(const email of ['a@gmail.com','a@outlook.com','a@proton.me'])assert.equal(mailSenderImage(email,true),null);
 assert.equal(mailSenderImage('notice@linkedin.com',false),null);
});
test('untrusted addresses cannot inject a URL or target literal local addresses',()=>{
 for(const email of [null,'a@localhost','a@127.0.0.1','a@[::1]','a@internal.local','a@foo.invalid','a@foo.com:123','a@foo.com/x','a@foo.com?x','a@user@foo.com','a@-foo.com','a@foo..com','a@foo.com\n'])assert.equal(mailSenderImage(email,true),null,email);
});
