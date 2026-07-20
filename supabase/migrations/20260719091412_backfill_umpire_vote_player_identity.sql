-- Apply only after the reviewed Umpire Match Voting identity report is approved.
-- This migration changes profile links and canonical player names only. It does
-- not change points, player numbers, teams, submission status or email state.

create temporary table umpire_vote_identity_backfill_map (
  line_id uuid primary key,
  revsports_player_id text not null
) on commit drop;

insert into umpire_vote_identity_backfill_map (line_id, revsports_player_id)
values
  ('00f40279-51df-43e6-9d00-f44d28259d11'::uuid, 'n7Xw8C8'),
  ('0173c6b3-1b45-418d-bf86-041813f9d217'::uuid, 'WlzOECO'),
  ('03f47284-0bb2-4c71-b95f-c4e457c3663b'::uuid, 'w8Ym1IX'),
  ('04d78271-5b7d-44cb-b260-2facd33dca4d'::uuid, '7yvnXi8'),
  ('04f5e996-4602-4c05-a99c-b41fbe988586'::uuid, 'Kb4NBSm'),
  ('051ba651-e8f3-47cf-bb9e-4be3220078c0'::uuid, 'vAj2JuZ'),
  ('061dc1ef-f8f0-4da1-ac05-4aa516a281c5'::uuid, 'O8VRGU9'),
  ('06e8b697-bef7-4a6e-803d-63b93cdd6694'::uuid, 'K7PDqsm'),
  ('0895aa22-f125-4e64-a811-f82b2c602d0b'::uuid, '4yEqGU3'),
  ('091717e4-3510-42a0-9564-d6280dc444a6'::uuid, 'B201BIJ'),
  ('0acf49ca-21d6-4691-8c40-ef0b35cfcc2c'::uuid, 'PVlLVFP'),
  ('0d03e1c8-78d2-4dce-a2c1-14276535a021'::uuid, 'VleLjSw'),
  ('0d0a85e0-a440-4ab0-a3f3-9984ec35cb8d'::uuid, 'ERz96HN'),
  ('0d85c7ac-dd42-46f0-a052-63a7b39300c7'::uuid, 'KvY9gUm'),
  ('0f2a060e-2b41-4e0b-b8a7-d829f682ebcd'::uuid, 'yb2bzI1'),
  ('0fd87ae5-b6f6-4d03-842a-63eb52283fe0'::uuid, 'b1D4DI3'),
  ('11659beb-1c7f-4740-9111-d7f9d5d43c34'::uuid, 'rqbXwCg'),
  ('120780f7-2f7f-4780-8862-8b4bb19e71f7'::uuid, '8kgbnhD'),
  ('130f9ff7-03d0-488e-b09c-af2ac486429c'::uuid, 'egRrPS3'),
  ('1343ff83-73ea-489a-9842-081aeef28dc5'::uuid, 'YGNkqFm'),
  ('134b1757-ff9e-4208-a172-7c22099f7514'::uuid, '0jJYLH3'),
  ('1578ceea-30f4-4f52-b087-2a36c2039399'::uuid, 'YGNkqFm'),
  ('158314a4-5102-405d-a917-ae9b0e5f79cc'::uuid, 'LykE8Fn'),
  ('16e4ff91-7778-4896-b634-edb29ceb3522'::uuid, 'ay68Lh1'),
  ('16eb822b-353f-4497-b60c-2fe166203be1'::uuid, 'KvzbeUm'),
  ('16f75227-3656-4ef1-9b8a-a45cea7fcbd4'::uuid, '030vJi3'),
  ('1914bced-0a40-4390-988a-0003743ab7f9'::uuid, 'vmY0XhZ'),
  ('1a38c234-ef19-402d-bb98-d4e8e3be92e0'::uuid, 'wBJOeFX'),
  ('1d7f0a2e-a4de-4183-b8d7-5323e683a877'::uuid, 'M1QNGha'),
  ('1d858f01-387b-4a4f-8ce6-c921b2be37c5'::uuid, 'nBBq8F8'),
  ('1e219c17-0a48-47cd-b8d2-aa2a8293e25a'::uuid, 'W6ePqIO'),
  ('1ea81911-15f4-4a42-9cb9-19fc98d579a5'::uuid, 'qr083tZ'),
  ('2060ba8f-2e86-4b8e-922c-c6133fa6b5f3'::uuid, 'k7GkgtR'),
  ('210b363d-e12f-4fb9-9248-0a5a46524167'::uuid, '0VgZZi3'),
  ('217e6ecb-73d8-4c7d-97d9-849e37a9186e'::uuid, 'MRPD9Ua'),
  ('23fdb88e-cc67-4157-8e2a-df2ba242309e'::uuid, 'WlrWbsO'),
  ('243ba5a3-465b-45b7-a1d3-ff03d1fa75a1'::uuid, 'b7LzDh3'),
  ('255a8262-d219-4a5c-934f-1fc906133e14'::uuid, 'A3l6QSq'),
  ('277fdcd4-8bd4-4e10-b2d3-1de542fccc7c'::uuid, 'AQXVQHq'),
  ('27eb98f8-23ef-4725-967d-a86475c789ec'::uuid, '7VGKQc8'),
  ('2a65ba53-e903-4a01-9318-d6db38cf0363'::uuid, '81Xx9CD'),
  ('2e60aa7b-39a5-41b8-927e-45cc6fd59abb'::uuid, 'gxa4Ghm'),
  ('2f33b317-068a-4b60-bbec-ff1dd2aa4f85'::uuid, 'j9KantN'),
  ('2fab023b-a966-4d6f-a5b1-cce8515194e3'::uuid, 'MnzWyca'),
  ('309ab3d6-12f9-421b-9257-02d2619f4515'::uuid, 'L8WGehn'),
  ('31b1328f-eb17-4c74-bcf9-cda6b10506a0'::uuid, 'B201BIJ'),
  ('329690d1-f3f4-4c5a-9bba-3f49aa2ded60'::uuid, 'n2J8YF8'),
  ('32de7f41-1880-4a80-b8db-83320abe5ee0'::uuid, 'D1VlkTk'),
  ('336b86eb-5a8d-499f-becb-2fdab81ed601'::uuid, 'nB3qZs8'),
  ('336e7147-ce47-418e-a25f-98812a176492'::uuid, 'N87A6Il'),
  ('365a0528-b557-42b2-b137-c097ccafb1f3'::uuid, 'MnzWyca'),
  ('3685f291-cf7f-4f47-a497-e6dc8287f584'::uuid, 'Qr6nDiw'),
  ('36c06d25-c9e2-42bd-b31d-30a695c5b136'::uuid, 'eOk1mu3'),
  ('3a328c20-387e-4ce6-8be1-6adfef989878'::uuid, 'M1gz2ua'),
  ('3accee29-6b9f-40ef-ad60-43c68a3b1f64'::uuid, 'PVlLVFP'),
  ('3bb7be7e-7de0-4077-87dd-45108f59bd49'::uuid, '62wr1s4'),
  ('3bbd6eb0-44fc-4ea8-b06d-4394fdb6d595'::uuid, 'g7nReHm'),
  ('3bde00e9-61f1-4268-9a5f-1220aa576691'::uuid, 'B201BIJ'),
  ('3e3c7547-c83e-4d92-9e15-4ccd2d85613d'::uuid, '13EaeH2'),
  ('3ec4d1ce-1f31-4f90-be4b-f7207f83d464'::uuid, '1JAzGu2'),
  ('3fb86a71-5519-448b-a842-5f4e4ba7352f'::uuid, 'K1BAnFm'),
  ('40e258e2-e5c0-4bb9-814b-474e4dff2e36'::uuid, 'egRrPS3'),
  ('41596f96-fc34-4687-9ca2-54380ee2a65b'::uuid, '7yQ12T8'),
  ('417eb34c-22f6-4cfc-8497-24fe3794fae1'::uuid, 'YGD44Sm'),
  ('41a4857f-d195-4a77-8303-abfb66ca9287'::uuid, 'MnzWyca'),
  ('41d3fc5f-27a9-4306-a6e5-220aae64734c'::uuid, 'yQBBkf1'),
  ('42317d4c-1217-49aa-b4be-b7fddda82b65'::uuid, '8kgBLhD'),
  ('433e87fa-52be-4b44-8ded-d6e88f184868'::uuid, 'Vl134Uw'),
  ('4349082e-8467-4f74-8f16-b96bf22f62ca'::uuid, 'b7LzDh3'),
  ('4563dd63-90b2-47c4-b3c0-8583120c90e6'::uuid, 'qlkQMtZ'),
  ('45e3a25e-1473-41cb-ba0f-d449e185cbbf'::uuid, '321vzsw'),
  ('47a2aa2f-03d0-4ca2-87df-c3826110d9e4'::uuid, 'n2J8YF8'),
  ('4855b234-0f65-4141-a1fd-d4c538ffa802'::uuid, 'Xen4vS8'),
  ('48900446-0d99-4c35-b87a-21411ac30871'::uuid, 'K1LzAim'),
  ('4d44554c-b935-4502-ab0f-1fcc317a5b5d'::uuid, '4yEqGU3'),
  ('4e519f68-8243-4a16-9c23-eac8b368cf3a'::uuid, 'RPa8mie'),
  ('4edd474d-dc2e-4162-8c2b-7d9cb058e462'::uuid, 'nGjbZi8'),
  ('4f384ddd-fcf6-4087-8637-34211b37565f'::uuid, 'AqnxAcq'),
  ('4f9e14bd-6fb4-46f8-993a-66234355acfd'::uuid, 'K1Z0rfm'),
  ('53820a05-28a5-43ee-8f7c-4dd161dd32ed'::uuid, '8OrX7uD'),
  ('553c8a99-1e0e-44e0-a65e-8f526f73e13d'::uuid, 'Dj9PWuk'),
  ('55bd90d6-9f49-47c7-9799-47b91b0e58d8'::uuid, 'WlrWbsO'),
  ('563b4a96-0f26-47d5-ae84-b0e2fb54d2c1'::uuid, 'MnzWyca'),
  ('56ab919d-e51e-468b-bef5-e7d8d3468cba'::uuid, 'Xe6qxh8'),
  ('5793cd72-e00d-44fe-9729-4ab7976390ac'::uuid, 'D1VlkTk'),
  ('57ed4415-71e5-42a8-94cb-6b95f1225c94'::uuid, '7yQ12T8'),
  ('5a90ff0b-d489-4496-b09f-94449ab6d537'::uuid, 'QDNK6Uw'),
  ('5b8b9a70-8bb9-4a32-8884-c7c87156d703'::uuid, 'EwlA9uN'),
  ('5c3fa021-9208-432e-a066-5124b593f8a8'::uuid, '9wGQ8IX'),
  ('5d10a3e6-b6a5-42a8-9c6d-9feb38dee388'::uuid, '3nWM7uw'),
  ('5d47d492-55be-4a39-b5d6-1c37e591c1ab'::uuid, 'rqbXwCg'),
  ('5d8a9a51-8b84-48cc-b210-c5ec56b2e964'::uuid, 'Qr6nDiw'),
  ('5e329e54-27b1-47a5-a9a3-b3f3472b038d'::uuid, 'gxa4Ghm'),
  ('5e7d5ce1-6b78-47ba-9426-a0b1af5f6fbe'::uuid, 'XereEs8'),
  ('609c1f39-9614-4f7f-a9df-b1ab42c65c95'::uuid, 'YGD44Sm'),
  ('614df885-e1ff-4d80-bcf5-f1e87f7c96a2'::uuid, 'Dj9PWuk'),
  ('62bb6f5c-05cd-4a50-8a84-c946cf240d02'::uuid, 'ga6jeCm'),
  ('68778e0c-40fe-4064-b5e8-c963428a0019'::uuid, 'EwlA9uN'),
  ('689d2812-d16d-40b0-a4bd-1d6393b78587'::uuid, 'K73Erhm'),
  ('690450fe-be38-4285-b6b1-97e8450e6fa5'::uuid, 'rXQYvSg'),
  ('6a60f847-a47e-4708-a0ce-6573cafaf0ee'::uuid, 'j9KantN'),
  ('6b1a6c69-8480-4dd3-86fc-c8f78b81b14c'::uuid, 'a1PznF1'),
  ('6cfdb522-855e-4fdf-b0ee-8834c1bf8c20'::uuid, 'mBkR4fP'),
  ('6e9cd994-1429-4dd6-802b-6b67ebdc92e4'::uuid, 'JbY41u1'),
  ('6eb92324-dbd0-4c63-8b0b-cbfa23f75288'::uuid, 'OBzjqt9'),
  ('705dbd5f-8bbb-4856-9acf-4f70b4a36901'::uuid, 'Xg4vvc8'),
  ('70c654b9-4205-417c-a703-5ac4527c891f'::uuid, 'eOzAjT3'),
  ('730cab8d-fdc3-4ac3-8572-eb01c1091aaa'::uuid, '7yQ12T8'),
  ('733c21cf-53b3-4cf9-b03b-2db406dd81e4'::uuid, 'ma8a4tP'),
  ('73a6a1b1-ff48-490f-9073-52ec7a899b74'::uuid, 'MnzWyca'),
  ('75de9593-fa9f-4d15-9413-63069a1fe7ea'::uuid, '9wRRgIX'),
  ('79610c29-9a7b-4c0d-b2a9-21ec6c52a8ef'::uuid, 'RPa8mie'),
  ('7a99d13a-ec2c-4ce5-b564-3719efcfceaa'::uuid, 'wBJOeFX'),
  ('7b06cd2f-d0ab-445f-aa61-dd6a63dd34ee'::uuid, 'L3ZNVun'),
  ('7b1b0a62-353a-4408-bdb4-673fa7c2db24'::uuid, 'VxQlZSw'),
  ('7b9750b2-232c-4b46-92b7-7d8291c5f5f6'::uuid, 'O8VRGU9'),
  ('7be49a96-9314-48d4-9c6d-1e3df4440698'::uuid, 'vmY0XhZ'),
  ('7c481104-eb9f-4de4-a962-6df35f3ba02d'::uuid, 'qlkQMtZ'),
  ('7d5e40b6-66d5-450a-b2af-3ebb9430112b'::uuid, 'ga6jeCm'),
  ('8279c1d1-7881-45d3-986b-dc1fa7698f86'::uuid, 'qOnPMiZ'),
  ('8812b7f1-1482-4b45-a880-cb43694fc972'::uuid, 'Ke6Peum'),
  ('88f47f9f-c82d-4efd-b7d5-bc6040d687db'::uuid, 'ayADnU1'),
  ('892a194f-babf-45e1-9823-fe747107c9b1'::uuid, 'L3ZNVun'),
  ('893e4192-094f-4b05-89e7-651c3a92e8da'::uuid, 'GbLjBSB'),
  ('8954308d-22b3-4c54-8c3c-c4953544803a'::uuid, 'wBj1RsX'),
  ('89d025dc-b759-4eac-95c9-ec2c138fc645'::uuid, 'K1Z0rfm'),
  ('8a3711e8-425c-4529-aa24-f57459c7d4ba'::uuid, 'yQBBkf1'),
  ('8b0b5fd3-1d75-4a32-96bf-7e03e5bce862'::uuid, 'w7LDgUX'),
  ('8b4496ed-f814-4354-a630-04208666f595'::uuid, 'vaMVyTZ'),
  ('8cdbfc4e-2f26-4eda-9f1a-5abd5d868175'::uuid, 'WlrWbsO'),
  ('8dd735b3-aaf7-4979-9bea-631238c7057e'::uuid, 'qzrbDcZ'),
  ('90e1daf8-4efe-4ac0-8dd5-4c5e46736866'::uuid, 'YGNkqFm'),
  ('91cdf4e3-ac68-4452-a678-e364fb4aab6e'::uuid, 'OBzjqt9'),
  ('92cc7130-7880-48bd-a001-6f2760a51dcd'::uuid, 'WlrWbsO'),
  ('944f387e-2cf4-4786-9d5f-1c666d7483a3'::uuid, 'zgZyxTB'),
  ('9478d1e1-d5a3-4501-8c80-443cc5fc7981'::uuid, 'Xen4vS8'),
  ('947fd3b0-3688-4948-97bb-8966a24008bc'::uuid, 'YGD44Sm'),
  ('966934e1-d7d4-444c-a24d-799057b8b5d5'::uuid, 'JbY41u1'),
  ('98d4620e-75cf-4724-a72e-63e57faf4911'::uuid, '8kgBLhD'),
  ('99a57620-26e7-4a3a-800e-ee6b85fc674f'::uuid, 'n7Xw8C8'),
  ('9ab32d54-0404-4b85-b5f8-c282a639a7ff'::uuid, 'aWyKLc1'),
  ('9beaa394-9a97-4d5c-9ac2-5cfa2a904bca'::uuid, 'g0myBTm'),
  ('9d1f48b3-c223-45d7-b194-5b5afe9fe495'::uuid, 'MnzWyca'),
  ('9ddd8757-df17-4832-b98a-d3974f359c2b'::uuid, 'zaaPLhB'),
  ('9e4a0665-51f5-4153-83c7-309ac08df437'::uuid, 'AQXVQHq'),
  ('9ea6c396-30e6-431d-90c6-c693e157c5dc'::uuid, 'RPa8mie'),
  ('9ff70a3f-0e1d-4784-93f7-7f1a381f9c5b'::uuid, 'Vzmr7iw'),
  ('a07c96f5-b911-44f7-9a6c-0bc084d30f9f'::uuid, 'nBBq8F8'),
  ('a094597a-ec43-4b79-a83f-996cd9a504b1'::uuid, 'B201BIJ'),
  ('a3b6fbd1-7275-4a8d-95dd-247919ebee9d'::uuid, 'B2nDqIJ'),
  ('a5cef116-30c1-440b-9cc6-bce44d42777a'::uuid, 'yQBBkf1'),
  ('a6652c59-0b49-4d4f-ad02-627740d3b1c7'::uuid, 'bk2vPh3'),
  ('a7b9b340-5eec-493d-a48e-62dec1da339c'::uuid, 'vywKzIZ'),
  ('a7ba95e0-84d6-4d2e-b0c5-2473a2590e35'::uuid, '0jJYLH3'),
  ('a8183dfa-4634-4842-91f5-a982695bb9bc'::uuid, 'YGD44Sm'),
  ('a93c8f3d-284d-4a14-81a9-352bfeaf8aa3'::uuid, 'O8ZBOf9'),
  ('a982dcd7-561f-4663-8114-b9ffd53a6495'::uuid, 'YzK84Um'),
  ('a9ec9eeb-01b5-409f-9667-41d543140090'::uuid, '29AZ3C2'),
  ('aa381cce-303a-4a9e-913a-8645563db027'::uuid, '1wOWai2'),
  ('aa6b01ab-c1d2-426c-bfbf-076337b5fbdd'::uuid, 'L3ZNVun'),
  ('ab78b7b1-1972-454e-8e32-946a76a76add'::uuid, 'Vwe6gFw'),
  ('adf16c2e-e3dd-4846-9ad9-f4d0d27ca6c4'::uuid, 'rqbXwCg'),
  ('ae28071b-b400-4a1f-b0fb-9dd28e80aa59'::uuid, 'Xg4vvc8'),
  ('af520ae7-2160-468a-b470-26694af37593'::uuid, 'ERz96HN'),
  ('af5d1488-2dea-4500-85b6-89063c3af878'::uuid, 'n2J8YF8'),
  ('afbce546-2a26-417d-a2e7-8ec772dc8628'::uuid, 'N1l7Bhl'),
  ('b1d9efc8-0775-4408-b8fd-9d64b6d6ed35'::uuid, 'L3ZNVun'),
  ('b264f1d9-7998-4c74-bad7-22e9f3251f0a'::uuid, 'v3b8AfZ'),
  ('b40e11b9-b55b-4fd1-9ff9-93f9bfd1cba5'::uuid, 'Vleg8fw'),
  ('b55cd328-a0e9-4bdd-88a2-0186c1add45b'::uuid, '12a9nu2'),
  ('b578d904-3b82-4c7a-acaa-94a1e836bbdd'::uuid, 'VxQlZSw'),
  ('b64ed245-5086-47b1-bace-b23e0ad116a6'::uuid, 'XzR8Au8'),
  ('b74ffeb9-d568-4673-85bd-c3926ca7e1a1'::uuid, 'WKQ9NIO'),
  ('b87f4cb7-4f89-4bde-b2cd-9700f08b0a21'::uuid, '4yEqGU3'),
  ('b99206b0-c8fb-4699-bd15-3b03f9e85c1d'::uuid, 'rq1KJIg'),
  ('b9af6ffd-5bf3-4eae-955e-3666bcca3676'::uuid, 'vy8GAfZ'),
  ('bd390848-df3a-4aa3-92b8-c3648f6b9fa1'::uuid, 'M1QNGha'),
  ('bee0d7f0-c5c8-4ff0-9256-80c4ee119f69'::uuid, '6zrygh4'),
  ('bf861d65-4a58-4079-aa7d-81113be5a2f6'::uuid, '710QqS8'),
  ('bfabaff5-523d-408d-9f09-f076f62d2240'::uuid, 'OBzjqt9'),
  ('c0b56830-17e9-4159-822c-75501b974db7'::uuid, '8kgBLhD'),
  ('c0c8219f-266e-44d2-b43d-57dfef373f99'::uuid, 'g0myBTm'),
  ('c2187901-4d35-4b66-ad99-65ec2ae19550'::uuid, 'MnzWyca'),
  ('c2398705-5490-4323-a574-86c42f0c79d3'::uuid, 'VOJWlIw'),
  ('c31e115e-4e99-4b1c-bf6c-3623621d2ac6'::uuid, 'M1gz2ua'),
  ('c438ad39-f1f9-456b-be9f-ca65c3e04ec0'::uuid, 'VOJWlIw'),
  ('c4abe360-455e-4660-9c31-9151a639f000'::uuid, '3DkXkTw'),
  ('c548eead-7fe9-485f-8f49-8ae77e20b3df'::uuid, 'eOzAjT3'),
  ('c59efd2e-bf6e-4018-abb5-74c0ea4c298a'::uuid, 'WKQ9NIO'),
  ('c5c1069c-dd47-4c4c-a4e2-50534dca1903'::uuid, 'qlkQMtZ'),
  ('c60e6ad5-ec11-4bf9-b64c-d01f33b97d28'::uuid, 'YGD44Sm'),
  ('c6b50fdb-4a4c-4307-9f38-3a0ca7791496'::uuid, 'nn8ywF8'),
  ('c728900c-bc81-4ef6-902c-4e2b46ac5220'::uuid, '7yvnXi8'),
  ('c7fba344-0c9d-47e0-b316-22a9346a734d'::uuid, '8kgBLhD'),
  ('c8283fbb-ec99-4272-acce-86440a56a850'::uuid, 'vywKzIZ'),
  ('c991f31e-a8a5-4999-b2ce-8972bc52cb71'::uuid, 'yEMAkf1'),
  ('ca115644-352d-4f1a-b85e-1eaf9f32236d'::uuid, '7yQ12T8'),
  ('cc2ae6d8-25fa-4640-8a83-65fb3be4bc66'::uuid, 'QlVJefw'),
  ('cea63370-c20a-4c72-b4be-1ce072496d78'::uuid, 'ERz96HN'),
  ('d0826591-a05b-440e-92b5-e66387890802'::uuid, '321vzsw'),
  ('d166e8e0-9fa6-4566-91d6-74e4c839734a'::uuid, '6XDkgu4'),
  ('d536b1ef-362c-41ad-8c24-b0976122c079'::uuid, 'VzNgZcw'),
  ('d79a7ca4-53c6-4520-ab8a-579abaa5014c'::uuid, 'Vwe6gFw'),
  ('d80b51cc-8967-42a4-af3c-220a8a1005e7'::uuid, 'JzYLzT1'),
  ('d8a3616a-2a83-4324-bd02-d5590e981df5'::uuid, '9KkRNCX'),
  ('d8d7b7f1-e863-4b56-a573-a9be13794fed'::uuid, 'QlVJefw'),
  ('da34c77d-9012-489d-bb95-4fab0749e412'::uuid, 'G8a7wcB'),
  ('dbd827c3-53c3-4656-b001-4dc6de2a0596'::uuid, 'vy8GAfZ'),
  ('dd246623-cc7c-42a6-b68a-400a06e1d168'::uuid, 'ERz96HN'),
  ('dff713bf-7c62-40b0-8cd0-a7a73f5d4755'::uuid, 'KvzbeUm'),
  ('e09c1fc2-4250-43bb-98a3-48d5c377c4b0'::uuid, 'Vl134Uw'),
  ('e27d6ff1-e1b6-4c38-bceb-a66bf30b5e0a'::uuid, 'nB3qZs8'),
  ('e2c60b64-a7ab-4bfc-ab9c-c0fe11ac4661'::uuid, 'gxa4Ghm'),
  ('e367225f-4080-40a2-8fcb-3dffbd0bbfe3'::uuid, 'JzYLzT1'),
  ('e39b4e25-5cfd-4313-b386-d449f008a15f'::uuid, 'ay68Lh1'),
  ('e3ba2020-48f2-4342-94cf-7f0889728d7b'::uuid, 'g7g37Hm'),
  ('e4a639f2-9129-4e8d-9c9c-f9d9612b7601'::uuid, 'zX68LfB'),
  ('e522bf80-ae41-443c-baa0-a5c5df1c656f'::uuid, 'P8bgrIP'),
  ('e67447c4-574b-4dd7-87b5-563194b7d5f9'::uuid, 'K73Erhm'),
  ('e6c8986b-a6f4-4547-9ab4-0d00b23fab4a'::uuid, 'OBzjqt9'),
  ('e75fb0bf-2881-4276-b10e-324c614b75bc'::uuid, '8OrX7uD'),
  ('e7b8a738-a4dc-4a4e-984a-6aeee1a610d5'::uuid, 'AqnxAcq'),
  ('e7f61aa2-66ee-407b-a0bd-6711186d03e5'::uuid, 'wBJOeFX'),
  ('e8a284e6-f39d-4215-a647-5b665176d6ab'::uuid, 'L3ZNVun'),
  ('e9387d9a-bba9-4612-b2a0-1def23ac66ac'::uuid, 'L3ELeFn'),
  ('e98abfac-4dec-4987-af26-ccb3f71d6094'::uuid, 'VlwBlfw'),
  ('e996028f-64c4-477f-b3a5-c50f8dd7d891'::uuid, '7VGKQc8'),
  ('e99d7dac-a813-433b-bc9e-7f211cd7eca7'::uuid, 'rq1KJIg'),
  ('eb8ed6f4-d25d-4827-bb31-7fee1b531dd0'::uuid, 'j9AXluN'),
  ('ec3222b1-ab07-422a-85ab-f1d93379a59f'::uuid, 'vy74XcZ'),
  ('ec95dca5-debc-4986-bb94-f9b4a0250905'::uuid, 'Xg4vvc8'),
  ('f17fe46d-55fa-43a2-8799-ede9edc446a1'::uuid, 'VwrDbcw'),
  ('f1b75fb9-01f5-4a99-aa93-7550c5dae757'::uuid, 'Vleg8fw'),
  ('f1e207ea-b12a-48fb-9d1f-10efd823a5ef'::uuid, 'YGNkqFm'),
  ('f3217a9d-a683-49a8-ae28-9a5f424929a8'::uuid, 'b1D4DI3'),
  ('f3243547-819f-4826-acaf-b64b866a9935'::uuid, 'qOnPMiZ'),
  ('f3fac6f8-521d-407b-8cfc-fb6df50bc413'::uuid, 'ERz96HN'),
  ('f4e0e565-10f8-44aa-bc08-729b973731de'::uuid, 'ay68Lh1'),
  ('f54d0d32-8249-44a0-b63d-711c0c684406'::uuid, 'k7GkgtR'),
  ('f5e13301-e640-4d1f-ad34-66d747939385'::uuid, 'yqjEnt1'),
  ('f609f0a0-8b00-453e-b5ba-49914ccc3633'::uuid, 'N87A6Il'),
  ('f63b2092-abb3-4bea-81d4-6fb42d0a3e77'::uuid, 'O62Qqi9'),
  ('f66c0db4-25c8-4e39-a106-9e9276fa0241'::uuid, 'KvzbeUm'),
  ('f7037f9a-0cd5-4822-b82d-bfb7d6ae1930'::uuid, 'Wl6JxuO'),
  ('f71a0415-4657-4e29-b923-7e40876e1375'::uuid, 'ln0M1hx'),
  ('f9e80851-05d3-4453-879f-84f8ddce88c2'::uuid, 'b1D4DI3'),
  ('fcb647a5-0a5f-451d-a487-498fa2bdcba7'::uuid, 'Qr6nDiw'),
  ('fd075723-a1e0-47a6-8216-8ac6d285554b'::uuid, 'eOzAjT3'),
  ('fd1b68bc-1ff1-459f-b4fa-d77ed6875c82'::uuid, '321vzsw'),
  ('fffaad77-f415-4a22-acdf-ae50d45e6188'::uuid, 'rXQYvSg');

create temporary table umpire_vote_identity_actor
on commit drop
as
select distinct profile.id as actor_id
from public.profiles profile
join public.user_roles role
  on role.user_id = profile.id
where role.role::text = 'SUPER_ADMIN'
  and lower(coalesce(profile.first_name, '')) = 'admin'
  and lower(coalesce(profile.last_name, '')) = 'sportstack';

do $guard$
declare
  v_line_count integer;
  v_snapshot_checksum text;
  v_actor_count integer;
  v_bad_profile_count integer;
  v_bad_registry_count integer;
begin
  select count(*)
  into v_line_count
  from public.player_vote_lines;

  if v_line_count <> 271 then
    raise exception 'Umpire vote backfill stopped: expected 271 lines, found %.', v_line_count;
  end if;

  select md5(
    string_agg(
      concat_ws(
        '|',
        line.id::text,
        line.submission_id::text,
        line.votes::text,
        line.player_name,
        coalesce(line.player_number::text, ''),
        coalesce(line.team_id::text, '')
      ),
      '||'
      order by line.id
    )
  )
  into v_snapshot_checksum
  from public.player_vote_lines line;

  if v_snapshot_checksum <> '64e69e27af02befeae361a75c9046f6c' then
    raise exception 'Umpire vote backfill stopped: vote-line snapshot has changed (%).', v_snapshot_checksum;
  end if;

  if (select count(*) from umpire_vote_identity_backfill_map) <> 250 then
    raise exception 'Umpire vote backfill stopped: mapping must contain exactly 250 lines.';
  end if;

  if (select count(distinct revsports_player_id) from umpire_vote_identity_backfill_map) <> 143 then
    raise exception 'Umpire vote backfill stopped: mapping must contain exactly 143 identities.';
  end if;

  if exists (
    select 1
    from umpire_vote_identity_backfill_map mapping
    left join public.player_vote_lines line
      on line.id = mapping.line_id
    where line.id is null
  ) then
    raise exception 'Umpire vote backfill stopped: a reviewed vote line no longer exists.';
  end if;

  if exists (
    select 1
    from public.player_vote_lines line
    where line.profile_id is not null
  ) then
    raise exception 'Umpire vote backfill stopped: one or more vote lines are already profile-linked.';
  end if;

  select count(*)
  into v_actor_count
  from umpire_vote_identity_actor;

  if v_actor_count <> 1 then
    raise exception 'Umpire vote backfill stopped: expected one Admin Sportstack audit actor, found %.', v_actor_count;
  end if;

  select count(*)
  into v_bad_profile_count
  from (
    select mapping.revsports_player_id
    from (
      select distinct revsports_player_id
      from umpire_vote_identity_backfill_map
    ) mapping
    left join public.profiles profile
      on profile.revsports_player_id = mapping.revsports_player_id
    group by mapping.revsports_player_id
    having count(profile.id) <> 1
  ) unresolved_profiles;

  if v_bad_profile_count <> 0 then
    raise exception 'Umpire vote backfill stopped: % RevSports IDs do not resolve to exactly one profile.', v_bad_profile_count;
  end if;

  select count(*)
  into v_bad_registry_count
  from (
    select mapping.revsports_player_id
    from (
      select distinct revsports_player_id
      from umpire_vote_identity_backfill_map
    ) mapping
    left join public.revsports_player_registry registry
      on registry.revsports_player_id = mapping.revsports_player_id
    group by mapping.revsports_player_id
    having count(registry.id) = 0
      or max(nullif(trim(registry.player_name), '')) is null
  ) unresolved_registry_names;

  if v_bad_registry_count <> 0 then
    raise exception 'Umpire vote backfill stopped: % RevSports IDs have no canonical registry name.', v_bad_registry_count;
  end if;

  if exists (
    select 1
    from public.player_vote_edits edit
    join umpire_vote_identity_backfill_map mapping
      on edit.field_name in (
        'vote_line_' || mapping.line_id::text || '_profile_id',
        'vote_line_' || mapping.line_id::text || '_player_name'
      )
  ) then
    raise exception 'Umpire vote backfill stopped: import audit rows already exist.';
  end if;
end;
$guard$;

create temporary table umpire_vote_identity_resolved
on commit drop
as
select
  mapping.line_id,
  mapping.revsports_player_id,
  line.submission_id,
  line.player_name as original_name,
  profile.id as profile_id,
  (
    select registry.player_name
    from public.revsports_player_registry registry
    where registry.revsports_player_id = mapping.revsports_player_id
    order by registry.scraped_at desc nulls last, registry.id
    limit 1
  ) as canonical_name,
  actor.actor_id
from umpire_vote_identity_backfill_map mapping
join public.player_vote_lines line
  on line.id = mapping.line_id
join public.profiles profile
  on profile.revsports_player_id = mapping.revsports_player_id
cross join umpire_vote_identity_actor actor;

do $counts$
declare
  v_resolved_count integer;
  v_profile_count integer;
  v_name_change_count integer;
  v_submission_count integer;
begin
  select
    count(*),
    count(distinct profile_id),
    count(*) filter (where original_name is distinct from canonical_name),
    count(distinct submission_id) filter (where original_name is distinct from canonical_name)
  into
    v_resolved_count,
    v_profile_count,
    v_name_change_count,
    v_submission_count
  from umpire_vote_identity_resolved;

  if v_resolved_count <> 250
    or v_profile_count <> 143
    or v_name_change_count <> 242
    or v_submission_count <> 78 then
    raise exception
      'Umpire vote backfill stopped: expected 250 links, 143 profiles, 242 names and 78 submissions; found %, %, % and %.',
      v_resolved_count,
      v_profile_count,
      v_name_change_count,
      v_submission_count;
  end if;
end;
$counts$;

insert into public.player_vote_edits (
  submission_id,
  changed_by_id,
  changed_at,
  field_name,
  original_value,
  new_value
)
select
  resolved.submission_id,
  resolved.actor_id,
  now(),
  'vote_line_' || resolved.line_id::text || '_profile_id',
  null,
  resolved.canonical_name || ' [' || resolved.profile_id::text || ']'
from umpire_vote_identity_resolved resolved;

insert into public.player_vote_edits (
  submission_id,
  changed_by_id,
  changed_at,
  field_name,
  original_value,
  new_value
)
select
  resolved.submission_id,
  resolved.actor_id,
  now(),
  'vote_line_' || resolved.line_id::text || '_player_name',
  resolved.original_name,
  resolved.canonical_name
from umpire_vote_identity_resolved resolved
where resolved.original_name is distinct from resolved.canonical_name;

update public.player_vote_lines line
set
  profile_id = resolved.profile_id,
  player_name = resolved.canonical_name
from umpire_vote_identity_resolved resolved
where line.id = resolved.line_id;

do $verify$
declare
  v_linked_count integer;
  v_unlinked_count integer;
  v_name_mismatch_count integer;
  v_import_audit_count integer;
begin
  select
    count(*) filter (where profile_id is not null),
    count(*) filter (where profile_id is null)
  into v_linked_count, v_unlinked_count
  from public.player_vote_lines;

  select count(*)
  into v_name_mismatch_count
  from umpire_vote_identity_resolved resolved
  join public.player_vote_lines line
    on line.id = resolved.line_id
  where line.profile_id is distinct from resolved.profile_id
    or line.player_name is distinct from resolved.canonical_name;

  select count(*)
  into v_import_audit_count
  from public.player_vote_edits edit
  join umpire_vote_identity_resolved resolved
    on edit.submission_id = resolved.submission_id
   and edit.field_name in (
     'vote_line_' || resolved.line_id::text || '_profile_id',
     'vote_line_' || resolved.line_id::text || '_player_name'
   );

  if v_linked_count <> 250
    or v_unlinked_count <> 21
    or v_name_mismatch_count <> 0
    or v_import_audit_count <> 492 then
    raise exception
      'Umpire vote backfill verification failed: linked %, unlinked %, mismatched %, audits %.',
      v_linked_count,
      v_unlinked_count,
      v_name_mismatch_count,
      v_import_audit_count;
  end if;
end;
$verify$;
